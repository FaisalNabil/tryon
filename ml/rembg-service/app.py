"""
rembg-service/app.py — Background removal microservice

Flask wrapper around rembg for removing backgrounds from frame images.
Called by the API's imageProcess service.
"""

from flask import Flask, request, send_file
from rembg import remove
from PIL import Image
import io

app = Flask(__name__)


@app.route('/health', methods=['GET'])
def health():
    return {'ok': True}


@app.route('/remove-bg', methods=['POST'])
def remove_bg():
    if 'image' not in request.files:
        return {'error': 'No image file provided'}, 400

    image_file = request.files['image']
    input_image = Image.open(image_file.stream)

    # Remove background using rembg
    output_image = remove(input_image)

    # Return as PNG with transparency
    buf = io.BytesIO()
    output_image.save(buf, format='PNG')
    buf.seek(0)

    return send_file(buf, mimetype='image/png')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
