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
import useLocalStorage from './hooks/useLocalStorage';
import './App.css';

// Constants
const DOUBLE_TAP_DELAY = 300; // milliseconds between taps
const LONG_PRESS_DURATION = 500; // milliseconds for long press

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
  const isSelected = selectedItemId === item.id;
  const isEditing = editingItemId === item.id;
  
  // Add useEffect to handle focus when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing, editInputRef]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: item.id,
    disabled: isEditing
  });

  const handleMouseDown = (e) => {
    if (e.target.closest('.delete-item') || isEditing) {
      return;
    }
    onItemClick(item.id);
  };

  const handleTouchStart = (e) => {
    if (isEditing) return;
    
    longPressTimer.current = setTimeout(() => {
      onLongPress(item);
    }, LONG_PRESS_DURATION);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteItem(item.id);
  };

  const style = {
    transform: transform ? `translate3d(0px, ${transform.y}px, 0)` : undefined,
    transition,
    textDecoration: item.completed ? 'line-through' : 'none'
  };

  return (
    <li
      ref={setNodeRef}
      className={`list-item 
        ${isSelected ? 'selected' : ''} 
        ${isDragging ? 'dragging' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div 
        className="item-content"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
      >
        {isEditing ? (
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
        ) : (
          <div className="item-content-inner">
            <span className="item-name">{item.name}</span>
            {isSelected && (
              <button 
                className="delete-item"
                onClick={handleDeleteClick}
                aria-label="Delete item"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

const ListTab = React.memo(({ list, isActive, onActivate, onDelete, onNameChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(list.name);
  const inputRef = useRef(null);
  const longPressTimer = useRef(null);

  // Add useEffect to handle focus when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleTouchStart = (e) => {
    if (isEditing) return;
    
    longPressTimer.current = setTimeout(() => {
      setIsEditing(true);
      setEditName(list.name);
    }, LONG_PRESS_DURATION);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleSave = () => {
    if (editName.trim() && editName !== list.name) {
      onNameChange(list.id, editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <button
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={() => !isEditing && onActivate(list.id)}
    >
      {isEditing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSave();
          }}
          className="list-edit-form"
          onClick={e => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleSave}
            className="list-edit-input"
          />
        </form>
      ) : (
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
      )}
      <button
        className="delete-list"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(list.id);
        }}
      >
        ×
      </button>
    </button>
  );
});

function App() {
  const [lists, setLists] = useLocalStorage('shopping-lists', []);
  const [activeList, setActiveList] = useState(null);
  const [listToDelete, setListToDelete] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showInstructions, setShowInstructions] = useLocalStorage('show-instructions', true);
  const editInputRef = useRef(null);
  const lastTap = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15,
        delay: 100,
        tolerance: 5,
      },
      // Only start drag on primary button
      buttons: [0],
      // Make sure we don't interfere with normal clicks
      modifiers: {
        // Cancel the drag if movement is minimal
        cancelDrag: ({ movement: { x, y }, events }) => {
          const distance = Math.sqrt(x * x + y * y);
          if (distance < 5) {
            // Allow click to propagate
            return true;
          }
          return false;
        }
      }
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

  // Add useEffect for input focus
  useEffect(() => {
    if (editingItemId && editInputRef.current) {
      const input = editInputRef.current;
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
    }
  }, [editingItemId]);

  const handleAddListClick = () => {
    const newList = {
      id: Date.now(),
      name: `List ${lists.length + 1}`,
      items: []
    };
    setLists([...lists, newList]);
    setActiveList(newList.id);
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
    
    if (!active || !over) return;
    
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
      // Double tap - complete item
      const updatedLists = lists.map(list => {
        if (list.id === activeList) {
          return {
            ...list,
            items: list.items.map(item => 
              item.id === itemId 
                ? { ...item, completed: !item.completed }
                : item
            )
          };
        }
        return list;
      });
      setLists(updatedLists);
      lastTap.current = null;
    } else {
      // Single tap - select item
      setSelectedItemId(itemId);
      lastTap.current = now;
    }
  };

  const handleItemLongPress = (item) => {
    setEditingItemId(item.id);
    setEditingText(item.name);
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

  const handleListNameChange = (listId, newName) => {
    const updatedLists = lists.map(list => 
      list.id === listId ? { ...list, name: newName } : list
    );
    setLists(updatedLists);
  };

  return (
    <div className="container">
      <h1>Shopping Lists</h1>
      
      <div className="lists-tabs">
        {lists.map(list => (
          <ListTab
            key={list.id}
            list={list}
            isActive={activeList === list.id}
            onActivate={setActiveList}
            onDelete={setListToDelete}
            onNameChange={handleListNameChange}
          />
        ))}
        <button 
          className="tab new-list-tab"
          onClick={handleAddListClick}
          aria-label="Create new list"
        >
          +
        </button>
      </div>

      {activeList && lists.find(list => list.id === activeList) && (
        <div className="active-list">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={lists.find(list => list.id === activeList).items.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="items-list">
                {lists.find(list => list.id === activeList).items.map((item) => (
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