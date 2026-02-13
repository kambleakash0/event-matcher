from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Get API key from environment variable
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in environment variables!")


@app.route('/api/chat', methods=['POST'])
def chat_proxy():
    try:
        data = request.get_json()
        conversation = data.get('inputs', '')

        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "user", "content": conversation}
                ],
                "max_tokens": 150,
                "temperature": 0.7
            },
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            message = result['choices'][0]['message']['content']
            return jsonify([{"generated_text": message}])
        else:
            print("Groq error:", response.text)
            return jsonify({"error": response.text}), 500

    except Exception as e:
        print("ERROR:", str(e))
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("Starting chat API on http://localhost:5001")
    app.run(debug=True, port=5001)
