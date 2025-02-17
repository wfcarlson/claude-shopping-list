# Shopping List App

A simple, intuitive shopping list app built with React.

## Development

To run the app locally: 

```bash
npm install
npm start
```

The app will be available at `http://localhost:3000`

## Deployment

To deploy to AWS S3:

```bash
npm run build
aws s3 sync build/ s3://walter-shopping-list/
```


## Note

This project was built entirely using Claude-3.5-Sonnet, an AI assistant by Anthropic. All code, styling, and architecture decisions were guided through conversation with Claude, demonstrating the potential of AI-assisted development.

### Features
- Multiple lists support
- Drag and drop reordering
- Long press to edit
- Double tap to complete items
- Responsive design
- Persistent storage