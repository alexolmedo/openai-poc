from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import os
from openai import OpenAI
import uuid
import json
from datetime import datetime, timezone

app = Flask(__name__)
CORS(app)

# Initialize the OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    messages = data['messages']
    client_id = data.get('clientId', str(uuid.uuid4()))

    def generate():
        full_response = ""
        stream = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            stream=True
        )
        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                content = chunk.choices[0].delta.content
                full_response += content
                yield f"data: {json.dumps({'content': content})}\n\n"

        # Save the complete conversation
        save_conversation(client_id, messages, full_response)

        yield f"data: [DONE]\n\n"

    return Response(generate(), content_type='text/event-stream')

def save_conversation(client_id, messages, response):
    conversation = {
        "_id": str(uuid.uuid4()),
        "clientId": client_id,
        "messages": [
            {
                "speaker": "user",
                "text": messages[-1]['content'],
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            {
                "speaker": "system",
                "text": response,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        ]
    }

    # Save to a JSON file (you might want to use a database in production)
    with open('conversations.json', 'a') as f:
        json.dump(conversation, f)
        f.write('\n')

@app.route('/api/history', methods=['GET'])
def get_history():
    client_id = request.args.get('clientId')
    conversations = []

    with open('conversations.json', 'r') as f:
        for line in f:
            conv = json.loads(line)
            if conv['clientId'] == client_id:
                conversations.append(conv)

    return jsonify(conversations)

if __name__ == '__main__':
    app.run(debug=True)