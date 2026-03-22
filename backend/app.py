import os
from flask import Flask, jsonify
from flask_cors import CORS


def create_app():
    app = Flask(__name__)
    app.secret_key = os.environ.get('SECRET_KEY', 'dev')

    CORS(app, origins=os.environ.get('APP_ORIGIN', 'http://localhost:5173'))

    @app.get('/health')
    def health():
        return jsonify({'status': 'ok'})

    return app
