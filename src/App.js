import React, { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useLocalStorage from './hooks/useLocalStorage';
import './App.css';

// Constants
const DOUBLE_TAP_DELAY = 300; // milliseconds between taps
const LONG_PRESS_DURATION = 500; // milliseconds for long press
const DELETE_THRESHOLD = 200;
const SHOW_DELETE_THRESHOLD = 100;
const REVEAL_THRESHOLD = 80; // pixels to reveal delete button

// Sortable item component
function SortableItem({ 
  item, 
  onItemClick, 
  selectedItemId, 
  editingItemId, 
  editingText, 
  editInputRef, 
  handleEditSave, 
  setEditingText,
  onLongPress,
  onDeleteItem
}) {
  const longPressTimer = useRef(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: item.id,
    disabled: editingItemId === item.id // Disable dragging while editing
  });

  const handleTouchStart = (e) => {
    if (editingItemId) return;
    
    longPressTimer.current = setTimeout(() => {
      onLongPress(item);
    }, LONG_PRESS_DURATION);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const style = {
    // Only use the Y transform value, ignore X
    transform: transform ? `translate3d(0px, ${transform.y}px, 0)` : undefined,
    transition,
    textDecoration: item.completed ? 'line-through' : 'none'
  };

  return (
    <li
      ref={setNodeRef}
      className={`list-item 
        ${selectedItemId === item.id ? 'selected' : ''} 
        ${isDragging ? 'dragging' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div 
        className="item-content"
        onClick={() => !editingItemId && onItemClick(item.id)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchEnd}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        {editingItemId === item.id ? (
          <>
            <form 
              className="edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleEditSave(item.id);
              }}
              onClick={e => e.stopPropagation()}
            >
              <input
                ref={editInputRef}
                type="text"
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={() => handleEditSave(item.id)}
                className="edit-input"
              />
            </form>
            <button 
              className="delete-item"
              onClick={() => onDeleteItem(item.id)}
              aria-label="Delete item"
            >
              ×
            </button>
          </>
        ) : (
          <span className="item-name">{item.name}</span>
        )}
      </div>
    </li>
  );
}

function App() {
  const [lists, setLists] = useLocalStorage('shopping-lists', []);
  const [newListName, setNewListName] = useState('');
  const [newItem, setNewItem] = useState('');
  const [activeList, setActiveList] = useState(null);
  const [listToDelete, setListToDelete] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showInstructions, setShowInstructions] = useLocalStorage('show-instructions', true);
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');

  const editInputRef = useRef(null);
  const editListInputRef = useRef(null);
  const lastTap = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15,
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Set the first list as active when the page loads
  useEffect(() => {
    if (lists.length > 0 && !activeList) {
      setActiveList(lists[0].id);
    }
  }, [lists, activeList]);

  const handleAddListClick = () => {
    const newList = {
      id: Date.now(),
      name: `List ${lists.length + 1}`,
      items: []
    };
    setLists([...lists, newList]);
    setActiveList(newList.id);
  };

  const addItem = (e) => {
    e.preventDefault();
    if (!newItem.trim() || activeList === null) return;

    const updatedLists = lists.map(list => {
      if (list.id === activeList) {
        return {
          ...list,
          items: [...list.items, {
            id: Date.now(),
            name: newItem,
            completed: false
          }]
        };
      }
      return list;
    });

    setLists(updatedLists);
    setNewItem('');
  };

  const toggleItem = (itemId) => {
    const updatedLists = lists.map(list => {
      if (list.id === activeList) {
        return {
          ...list,
          items: list.items.map(item => {
            if (item.id === itemId) {
              return { ...item, completed: !item.completed };
            }
            return item;
          })
        };
      }
      return list;
    });

    setLists(updatedLists);
  };

  const handleDeleteConfirm = (confirmed) => {
    if (confirmed) {
      setLists(lists.filter(list => list.id !== listToDelete));
      if (activeList === listToDelete) {
        setActiveList(lists.length > 1 ? lists[0].id : null);
      }
    }
    setListToDelete(null);
  };

  const handleDeleteItem = (itemId) => {
    const updatedLists = lists.map(list => {
      if (list.id === activeList) {
        return {
          ...list,
          items: list.items.filter(item => item.id !== itemId)
        };
      }
      return list;
    });
    setLists(updatedLists);
    setSelectedItemId(null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const updatedLists = lists.map(list => {
        if (list.id === activeList) {
          const oldIndex = list.items.findIndex(item => item.id === active.id);
          const newIndex = list.items.findIndex(item => item.id === over.id);
          
          return {
            ...list,
            items: arrayMove(list.items, oldIndex, newIndex)
          };
        }
        return list;
      });
      
      setLists(updatedLists);
    }
  };

  const handleItemClick = (itemId) => {
    const now = Date.now();
    if (lastTap.current && (now - lastTap.current) < DOUBLE_TAP_DELAY) {
      toggleItem(itemId);
      lastTap.current = null;
      setSelectedItemId(null);
    } else {
      setSelectedItemId(selectedItemId === itemId ? null : itemId);
      lastTap.current = now;
    }
  };

  const handleItemLongPress = (item) => {
    setEditingItemId(item.id);
    setEditingText(item.name);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const handleEditSave = (itemId) => {
    if (editingText.trim()) {
      const updatedLists = lists.map(list => {
        if (list.id === activeList) {
          return {
            ...list,
            items: list.items.map(item => {
              if (item.id === itemId) {
                return { ...item, name: editingText.trim() };
              }
              return item;
            })
          };
        }
        return list;
      });
      setLists(updatedLists);
    }
    setEditingItemId(null);
    setEditingText('');
  };

  const handleListEditSave = (listId) => {
    if (editingListName.trim()) {
      const updatedLists = lists.map(list => {
        if (list.id === listId) {
          return { ...list, name: editingListName.trim() };
        }
        return list;
      });
      setLists(updatedLists);
    }
    setEditingListId(null);
    setEditingListName('');
  };

  const activeListData = lists.find(list => list.id === activeList);

  return (
    <div className="container">
      <h1>Shopping Lists</h1>
      
      <div className="lists-tabs">
        {lists.map(list => {
          const isEditing = editingListId === list.id;
          const ListNameContent = () => {
            const longPressTimer = useRef(null);

            const handleTouchStart = (e) => {
              longPressTimer.current = setTimeout(() => {
                setEditingListId(list.id);
                setEditingListName(list.name);
                setTimeout(() => editListInputRef.current?.focus(), 50);
              }, LONG_PRESS_DURATION);
            };

            const handleTouchEnd = () => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
              }
            };

            if (isEditing) {
              return (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleListEditSave(list.id);
                  }}
                  className="list-edit-form"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={editListInputRef}
                    type="text"
                    value={editingListName}
                    onChange={(e) => setEditingListName(e.target.value)}
                    onBlur={() => handleListEditSave(list.id)}
                    className="list-edit-input"
                  />
                </form>
              );
            }

            return (
              <span
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                className="list-name"
              >
                {list.name}
              </span>
            );
          };

          return (
            <button
              key={list.id}
              className={`tab ${activeList === list.id ? 'active' : ''}`}
              onClick={() => !isEditing && setActiveList(list.id)}
            >
              <ListNameContent />
              <button
                className="delete-list"
                onClick={(e) => {
                  e.stopPropagation();
                  setListToDelete(list.id);
                }}
              >
                ×
              </button>
            </button>
          );
        })}
        <button 
          className="tab new-list-tab"
          onClick={handleAddListClick}
          aria-label="Create new list"
        >
          +
        </button>
      </div>

      {activeList && activeListData && (
        <div className="active-list">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activeListData.items.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="items-list">
                {activeListData.items.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    onItemClick={handleItemClick}
                    selectedItemId={selectedItemId}
                    editingItemId={editingItemId}
                    editingText={editingText}
                    editInputRef={editInputRef}
                    handleEditSave={handleEditSave}
                    setEditingText={setEditingText}
                    onLongPress={handleItemLongPress}
                    onDeleteItem={handleDeleteItem}
                  />
                ))}
                <li className="list-item new-item">
                  <div 
                    className="item-content"
                    onClick={() => {
                      const updatedLists = lists.map(list => {
                        if (list.id === activeList) {
                          return {
                            ...list,
                            items: [
                              ...list.items,
                              {
                                id: Date.now(),
                                name: `Item ${list.items.length + 1}`,
                                completed: false
                              }
                            ]
                          };
                        }
                        return list;
                      });
                      setLists(updatedLists);
                    }}
                  >
                    <span className="item-name">
                      <span className="add-icon">+</span>
                      Add item
                    </span>
                  </div>
                </li>
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {lists.length === 0 && (
        <p>Create your first shopping list!</p>
      )}

      {showInstructions && (
        <div className="instructions-modal">
          <button 
            className="close-instructions"
            onClick={() => setShowInstructions(false)}
            aria-label="Close instructions"
          >
            ×
          </button>
          <div className="instruction-item">
            <span className="instruction-icon">👆</span>
            <span>tap to select an item</span>
          </div>
          <div className="instruction-item">
            <span className="instruction-icon">👆👆</span>
            <span>double tap to cross off</span>
          </div>
          <div className="instruction-item">
            <span className="instruction-icon">👆💫</span>
            <span>long press to edit</span>
          </div>
          <div className="instruction-item">
            <span className="instruction-icon">☰</span>
            <span>drag and drop to reorder</span>
          </div>
        </div>
      )}

      {listToDelete && (
        <div className="delete-modal">
          <p>Delete this list?</p>
          <div className="delete-modal-actions">
            <button
              onClick={() => {
                setLists(lists.filter(list => list.id !== listToDelete));
                setListToDelete(null);
                if (activeList === listToDelete) {
                  setActiveList(lists[0]?.id);
                }
              }}
            >
              Delete
            </button>
            <button onClick={() => setListToDelete(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 