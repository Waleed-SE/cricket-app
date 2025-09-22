# Cricket Match Scoring & Display Interface

A comprehensive cricket scoring application with real-time match display and control panel.

## Features

- Real-time live scoreboard with broadcast-style graphics
- Match control panel for ball-by-ball input
- Player statistics tracking
- Data persistence and match state management
- WebSocket-based real-time updates

## Quick Start

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Run the application:

```bash
python app.py
```

3. Open your browser:

- Control Panel: http://localhost:5000/control
- Live Display: http://localhost:5000/display

## Usage

1. Set up match details in the control panel
2. Start scoring ball by ball
3. View the live scoreboard in the display window
4. All data is automatically saved and can be resumed

## Project Structure

- `app.py` - Main Flask application with WebSocket server
- `models.py` - Cricket match data models
- `templates/` - HTML templates
- `static/` - CSS and JavaScript files
- `data/` - Match data storage
