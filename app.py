from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import os
import json
import uuid
from werkzeug.utils import secure_filename
from models import Match, WicketType, ExtraType
from typing import Optional

app = Flask(__name__)
app.config['SECRET_KEY'] = 'cricket_scoring_secret_key'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'static/uploads/flags'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Create upload directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Allowed file extensions for flags
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Global match instance
current_match: Optional[Match] = None

@app.route('/')
def index():
    """Main page with links to control and display"""
    return render_template('index.html')

@app.route('/control')
def control():
    """Match control panel"""
    return render_template('control.html')

@app.route('/display')
def display():
    """Live match display dashboard"""
    return render_template('display.html')

# API Routes
@app.route('/api/matches')
def get_saved_matches():
    """Get list of saved matches"""
    matches = []
    if os.path.exists('data'):
        for filename in os.listdir('data'):
            if filename.startswith('match_') and filename.endswith('.json'):
                match_id = filename[6:-5]  # Remove 'match_' and '.json'
                matches.append({'id': match_id, 'filename': filename})
    return jsonify(matches)

@app.route('/api/match/status')
def get_match_status():
    """Get current match status"""
    global current_match
    if current_match:
        return jsonify(current_match.get_current_status())
    return jsonify({'error': 'No active match'})

@app.route('/api/upload-flag', methods=['POST'])
def upload_flag():
    """Upload team flag image"""
    try:
        if 'flag' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['flag']
        team_name = request.form.get('team_name', '')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            # Generate unique filename
            filename = secure_filename(file.filename)
            unique_filename = f"{team_name}_{uuid.uuid4().hex[:8]}.{filename.rsplit('.', 1)[1].lower()}"
            
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(filepath)
            
            # Return the URL path for the uploaded flag
            flag_url = f"/static/uploads/flags/{unique_filename}"
            
            return jsonify({
                'success': True,
                'flag_url': flag_url,
                'filename': unique_filename
            })
        else:
            return jsonify({'error': 'Invalid file type. Please upload PNG, JPG, JPEG, GIF, or SVG files.'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/saved-flags')
def get_saved_flags():
    """Get list of saved flag files"""
    try:
        flags = []
        flags_dir = app.config['UPLOAD_FOLDER']
        
        if os.path.exists(flags_dir):
            for filename in os.listdir(flags_dir):
                if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg')):
                    # Extract team name from filename (before the first underscore and UUID)
                    team_name = filename.split('_')[0] if '_' in filename else filename.rsplit('.', 1)[0]
                    
                    flags.append({
                        'filename': filename,
                        'team_name': team_name,
                        'url': f"/static/uploads/flags/{filename}"
                    })
        
        # Sort by team name for better organization
        flags.sort(key=lambda x: x['team_name'].lower())
        
        return jsonify({'flags': flags})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print('Client connected')
    if current_match:
        emit('match_update', current_match.get_current_status())

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print('Client disconnected')

@socketio.on('create_match')
def handle_create_match(data):
    """Create a new match"""
    global current_match
    try:
        current_match = Match(
            team1_name=data['team1'],
            team2_name=data['team2'],
            total_overs=int(data['total_overs']),
            team1_flag=data.get('team1_flag', ''),
            team2_flag=data.get('team2_flag', '')
        )
        
        # Add players
        for player in data['team1_players']:
            current_match.add_player(player, data['team1'])
        
        for player in data['team2_players']:
            current_match.add_player(player, data['team2'])
        
        # Set toss
        current_match.set_toss(data['toss_winner'], data['toss_decision'])
        
        # Save match
        current_match.save_to_file()
        
        emit('match_created', current_match.get_current_status())
        socketio.emit('match_update', current_match.get_current_status())
        
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('start_innings')
def handle_start_innings(data):
    """Start the innings"""
    global current_match
    try:
        if current_match:
            current_match.start_innings(
                striker=data['striker'],
                non_striker=data['non_striker'],
                bowler=data['bowler']
            )
            current_match.save_to_file()
            socketio.emit('match_update', current_match.get_current_status())
            emit('innings_started', {'success': True})
        else:
            emit('error', {'message': 'No active match'})
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('add_ball')
def handle_add_ball(data):
    """Add a ball to the match"""
    global current_match
    try:
        if not current_match:
            emit('error', {'message': 'No active match'})
            return
        
        # Parse wicket type
        wicket_type = None
        if data.get('wicket_type'):
            wicket_type = WicketType(data['wicket_type'])
        
        # Parse extra type
        extra_type = None
        if data.get('extra_type'):
            extra_type = ExtraType(data['extra_type'])
        
        result = current_match.add_ball(
            runs=int(data.get('runs', 0)),
            is_wicket=data.get('is_wicket', False),
            wicket_type=wicket_type,
            dismissed_player=data.get('dismissed_player'),
            extra_type=extra_type,
            extra_runs=int(data.get('extra_runs', 0))
        )
        
        current_match.save_to_file()
        socketio.emit('match_update', current_match.get_current_status())
        emit('ball_added', result)
        
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('undo_last_ball')
def handle_undo_last_ball():
    """Undo the last ball"""
    global current_match
    try:
        if not current_match:
            emit('error', {'message': 'No active match'})
            return
        
        result = current_match.undo_last_ball()
        if result['success']:
            current_match.save_to_file()
            socketio.emit('match_update', current_match.get_current_status())
            emit('ball_undone', result)
        else:
            emit('error', {'message': result['message']})
        
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('set_new_bowler')
def handle_new_bowler(data):
    """Set new bowler for next over"""
    global current_match
    try:
        if current_match:
            current_match.set_new_bowler(data['bowler'])
            current_match.save_to_file()
            socketio.emit('match_update', current_match.get_current_status())
            emit('bowler_set', {'success': True})
        else:
            emit('error', {'message': 'No active match'})
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('set_new_batter')
def handle_new_batter(data):
    """Set new batter after wicket"""
    global current_match
    try:
        if current_match:
            current_match.set_new_batter(data['batter'])
            current_match.save_to_file()
            socketio.emit('match_update', current_match.get_current_status())
            emit('batter_set', {'success': True})
        else:
            emit('error', {'message': 'No active match'})
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('load_match')
def handle_load_match(data):
    """Load a saved match"""
    global current_match
    try:
        filepath = f"data/match_{data['match_id']}.json"
        current_match = Match.load_from_file(filepath)
        socketio.emit('match_update', current_match.get_current_status())
        emit('match_loaded', {'success': True})
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('save_match')
def handle_save_match():
    """Save current match"""
    global current_match
    try:
        if current_match:
            current_match.save_to_file()
            emit('match_saved', {'success': True})
        else:
            emit('error', {'message': 'No active match'})
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('start_second_innings')
def handle_start_second_innings(data):
    """Start the second innings with opening players"""
    global current_match
    try:
        if not current_match:
            emit('error', {'message': 'No active match'})
            return
            
        if current_match.current_innings != 2:
            emit('error', {'message': 'Not ready for second innings'})
            return
        
        current_match.start_second_innings(
            data['striker'],
            data['non_striker'], 
            data['bowler']
        )
        
        current_match.save_to_file()
        socketio.emit('match_update', current_match.get_current_status())
        emit('second_innings_started', {'success': True})
        
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('get_players')
def handle_get_players(data):
    """Get players for a team"""
    global current_match
    try:
        if current_match:
            team_name = data['team']
            if team_name.lower() == current_match.team1.name.lower():
                players = current_match.team1.players
            else:
                players = current_match.team2.players
            emit('players_list', {'players': players})
        else:
            emit('error', {'message': 'No active match'})
    except Exception as e:
        emit('error', {'message': str(e)})

if __name__ == '__main__':
    # Create data directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    # Run the application
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)