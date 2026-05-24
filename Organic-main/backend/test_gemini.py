import google.generativeai as genai
import os
import json
import base64
import requests
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

print("Testing model: gemini-flash-lite-latest")
model = genai.GenerativeModel('gemini-flash-lite-latest')

try:
    response = model.generate_content("Hello")
    print("Text OK:", response.text.strip())
except Exception as e:
    print("Text Error:", e)

print("Downloading sample image...")
img_url = "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400"
img_data = requests.get(img_url).content
b64_str = base64.b64encode(img_data).decode('utf-8')

image_part = {
    "mime_type": "image/jpeg",
    "data": base64.b64decode(b64_str)
}

try:
    print("Testing image recognition...")
    response = model.generate_content(["Describe this image", image_part])
    print("Image OK:", response.text.strip())
except Exception as e:
    print("Image Error:", e)
