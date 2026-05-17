from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from groq import Groq
from openai import OpenAI
from dotenv import load_dotenv

import os
import json
import re
import base64
import uuid
from pathlib import Path

import edge_tts

try:
    from moviepy import (
        ImageClip,
        VideoFileClip,
        AudioFileClip,
        concatenate_videoclips,
    )
except ImportError:
    from moviepy.editor import (
        ImageClip,
        VideoFileClip,
        AudioFileClip,
        concatenate_videoclips,
    )


load_dotenv()

app = FastAPI(title="AI Creator Studio Backend")


# Folders
GENERATED_VIDEOS_DIR = Path("generated_videos")
TEMP_IMAGES_DIR = Path("temp_images")
GENERATED_AUDIO_DIR = Path("generated_audio")

GENERATED_VIDEOS_DIR.mkdir(exist_ok=True)
TEMP_IMAGES_DIR.mkdir(exist_ok=True)
GENERATED_AUDIO_DIR.mkdir(exist_ok=True)


# Static files
app.mount(
    "/generated_videos",
    StaticFiles(directory=str(GENERATED_VIDEOS_DIR)),
    name="generated_videos",
)

app.mount(
    "/generated_audio",
    StaticFiles(directory=str(GENERATED_AUDIO_DIR)),
    name="generated_audio",
)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "https://ai-creator-studio-delta.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY missing in .env")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY missing in .env")

groq_client = Groq(api_key=GROQ_API_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
OPENAI_IMAGE_SIZE = os.getenv("OPENAI_IMAGE_SIZE", "1024x1024")
OPENAI_IMAGE_QUALITY = os.getenv("OPENAI_IMAGE_QUALITY", "medium")


# Request models
class ThumbnailRequest(BaseModel):
    title: str
    style: str
    mood: str


class StoryRequest(BaseModel):
    genre: str
    characters: str
    moral: str
    duration: str
    language: str


class SceneImagesRequest(BaseModel):
    scenes: list


class DialogueScenesRequest(BaseModel):
    dialogue: str
    language: str = "Hindi"


class VoiceoverRequest(BaseModel):
    scenes: list
    language: str = "Hindi"


class AddVoiceoverRequest(BaseModel):
    video_path: str
    scenes: list
    language: str = "Hindi"


class SyncedVideoRequest(BaseModel):
    scenes: list
    language: str = "Hindi"


# Helpers
def extract_json_array(text: str):
    match = re.search(r"\[.*\]", text, re.DOTALL)

    if not match:
        raise HTTPException(
            status_code=500,
            detail="No valid JSON array found in AI response.",
        )

    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid JSON received from AI response: {exc}",
        )


def generate_openai_image(prompt: str, size: str = OPENAI_IMAGE_SIZE):
    try:
        result = openai_client.images.generate(
            model=OPENAI_IMAGE_MODEL,
            prompt=prompt,
            size=size,
            quality=OPENAI_IMAGE_QUALITY,
            output_format="png",
            n=1,
        )

        image_base64 = result.data[0].b64_json

        if not image_base64:
            raise HTTPException(
                status_code=500,
                detail="OpenAI did not return base64 image data.",
            )

        return image_base64

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"OpenAI image generation failed: {exc}",
        )


def get_voice_name(language: str):
    language_lower = language.lower()

    if "hindi" in language_lower or "hi" in language_lower:
        return "hi-IN-MadhurNeural"

    if "english" in language_lower or "en" in language_lower:
        return "en-IN-PrabhatNeural"

    return "hi-IN-MadhurNeural"


def build_voiceover_text(scenes: list):
    voiceover_parts = []

    for scene in scenes:
        if isinstance(scene, dict):
            text = (
                scene.get("voiceover")
                or scene.get("dialogue")
                or scene.get("description")
                or scene.get("scene_title")
                or ""
            )
        else:
            text = str(scene)

        text = text.strip()

        if text:
            voiceover_parts.append(text)

    if not voiceover_parts:
        raise HTTPException(
            status_code=400,
            detail="No voiceover, dialogue, or description found in scenes.",
        )

    return " ".join(voiceover_parts)


async def generate_voiceover_audio(text: str, language: str = "Hindi"):
    audio_filename = f"voiceover_{uuid.uuid4().hex}.mp3"
    audio_path = GENERATED_AUDIO_DIR / audio_filename

    voice_name = get_voice_name(language)

    try:
        communicate = edge_tts.Communicate(text=text, voice=voice_name)
        await communicate.save(str(audio_path))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Voiceover generation failed: {exc}",
        )

    return str(audio_path), f"/generated_audio/{audio_filename}"


def add_audio_to_video(video_path: str, audio_path: str):
    original_video_path = Path(video_path)

    if not original_video_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Video file not found: {video_path}",
        )

    if not Path(audio_path).exists():
        raise HTTPException(
            status_code=404,
            detail=f"Audio file not found: {audio_path}",
        )

    final_filename = f"final_video_{uuid.uuid4().hex}.mp4"
    final_path = GENERATED_VIDEOS_DIR / final_filename

    video = None
    audio = None
    final_video = None

    try:
        video = VideoFileClip(str(original_video_path))
        audio = AudioFileClip(str(audio_path))

        if audio.duration > video.duration:
            try:
                audio = audio.subclipped(0, video.duration)
            except AttributeError:
                audio = audio.subclip(0, video.duration)

        try:
            final_video = video.with_audio(audio)
        except AttributeError:
            final_video = video.set_audio(audio)

        final_video.write_videofile(
            str(final_path),
            fps=24,
            codec="libx264",
            audio_codec="aac",
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Adding voiceover to video failed: {exc}",
        )

    finally:
        for clip in [final_video, audio, video]:
            try:
                if clip:
                    clip.close()
            except Exception:
                pass

    return str(final_path), f"/generated_videos/{final_filename}"


# Routes
@app.get("/")
def home():
    return {"message": "AI Creator Studio Backend Running"}


@app.post("/generate-thumbnail")
def generate_thumbnail(request: ThumbnailRequest):
    prompt = f"""
Create a viral YouTube thumbnail for this title: {request.title}.

Style: {request.style}
Mood: {request.mood}

Requirements:
- cinematic lighting
- emotional expression
- colorful and high contrast
- 3D animated style
- ultra detailed
- professional YouTube thumbnail composition
- leave empty space for title text
- no watermark
- no random text inside the image
"""

    image_base64 = generate_openai_image(prompt, size=OPENAI_IMAGE_SIZE)

    return {
        "success": True,
        "image_base64": image_base64,
    }


@app.post("/generate-story")
def generate_story(request: StoryRequest):
    prompt = f"""
Create a {request.duration} {request.genre} story.

Characters:
{request.characters}

Moral:
{request.moral}

Language:
{request.language}

Requirements:
- engaging beginning
- emotional storytelling
- dialogues
- narration
- strong ending
- suitable for YouTube video
"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional YouTube story writer.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.8,
            max_tokens=2500,
        )

        story = completion.choices[0].message.content

        return {
            "success": True,
            "story": story,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Story generation failed: {exc}",
        )


@app.post("/generate-scenes")
def generate_scenes(request: StoryRequest):
    prompt = f"""
Create exactly 5 cinematic storyboard scenes in valid JSON only.

Genre: {request.genre}
Characters: {request.characters}
Moral: {request.moral}
Duration: {request.duration}
Language: {request.language}

Return only this JSON array format:

[
  {{
    "scene_number": 1,
    "scene_title": "Scene title",
    "description": "Short scene description",
    "visual_prompt": "Detailed image generation prompt",
    "camera_angle": "Camera angle",
    "voiceover": "Voiceover text",
    "duration_seconds": 12
  }}
]

Rules:
- Return only JSON
- No markdown
- No explanation
- Keep character appearance consistent
- visual_prompt must be cinematic, emotional, 3D animated, colorful, high detail
"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a storyboard artist. Return only valid JSON.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.7,
            max_tokens=2500,
        )

        scenes_text = completion.choices[0].message.content.strip()
        scenes = extract_json_array(scenes_text)

        return {
            "success": True,
            "title": f"{request.genre} Scene Prompts",
            "scenes": scenes,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Scene generation failed: {exc}",
        )


@app.post("/generate-scenes-from-dialogue")
def generate_scenes_from_dialogue(request: DialogueScenesRequest):
    if not request.dialogue.strip():
        raise HTTPException(
            status_code=400,
            detail="Dialogue/script is required.",
        )

    prompt = f"""
Convert the following dialogue/script into exactly 5 cinematic storyboard scenes.

Language: {request.language}

Dialogue/Script:
{request.dialogue}

Return only valid JSON array:

[
  {{
    "scene_number": 1,
    "scene_title": "Scene title",
    "description": "What happens in this scene",
    "visual_prompt": "Detailed image generation prompt for this scene",
    "camera_angle": "Camera angle",
    "characters_present": "Characters visible in this scene",
    "dialogue": "Important dialogue from this scene",
    "voiceover": "Narration for this scene",
    "duration_seconds": 12
  }}
]

Rules:
- Return only JSON
- No markdown
- No explanation
- Keep character appearance consistent
- visual_prompt must describe character, background, emotion, lighting, and 3D animated style
"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional storyboard artist. Return only valid JSON.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.7,
            max_tokens=2500,
        )

        scenes_text = completion.choices[0].message.content.strip()
        scenes = extract_json_array(scenes_text)

        return {
            "success": True,
            "title": "Scenes Generated from Dialogue",
            "scenes": scenes,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Scene from dialogue generation failed: {exc}",
        )


@app.post("/generate-scene-images")
def generate_scene_images(request: SceneImagesRequest):
    if not request.scenes:
        raise HTTPException(status_code=400, detail="Scenes are required.")

    images = []

    for scene in request.scenes[:5]:
        visual_prompt = scene.get("visual_prompt", "")
        scene_number = scene.get("scene_number", len(images) + 1)
        scene_title = scene.get("scene_title", f"Scene {scene_number}")

        if not visual_prompt:
            raise HTTPException(
                status_code=400,
                detail=f"visual_prompt is missing for scene {scene_number}.",
            )

        image_prompt = f"""
{visual_prompt}

Style requirements:
- 3D animated movie style
- cinematic lighting
- emotional expression
- high detail
- beautiful background
- YouTube story scene
- sharp focus
- no watermark
- no random text inside the image
"""

        image_base64 = generate_openai_image(image_prompt, size=OPENAI_IMAGE_SIZE)

        images.append(
            {
                "scene_number": scene_number,
                "scene_title": scene_title,
                "image_base64": image_base64,
                "voiceover": scene.get("voiceover", ""),
                "dialogue": scene.get("dialogue", ""),
                "description": scene.get("description", ""),
                "duration_seconds": scene.get("duration_seconds", 4),
            }
        )

    return {
        "success": True,
        "images": images,
    }


@app.post("/create-video-from-images")
def create_video_from_images(request: SceneImagesRequest):
    if not request.scenes:
        raise HTTPException(status_code=400, detail="Images are required.")

    clips = []

    for index, item in enumerate(request.scenes):
        image_base64 = item.get("image_base64")
        duration_seconds = item.get("duration_seconds", 4)

        if not image_base64:
            continue

        image_path = TEMP_IMAGES_DIR / f"scene_{uuid.uuid4().hex}_{index + 1}.png"

        try:
            with open(image_path, "wb") as file:
                file.write(base64.b64decode(image_base64))
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid base64 image for scene {index + 1}: {exc}",
            )

        try:
            clip = ImageClip(str(image_path)).with_duration(duration_seconds)
        except AttributeError:
            clip = ImageClip(str(image_path)).set_duration(duration_seconds)

        clips.append(clip)

    if not clips:
        raise HTTPException(status_code=400, detail="No valid images found.")

    video_filename = f"video_{uuid.uuid4().hex}.mp4"
    video_path = GENERATED_VIDEOS_DIR / video_filename

    final_video = None

    try:
        final_video = concatenate_videoclips(clips, method="compose")

        final_video.write_videofile(
            str(video_path),
            fps=24,
            codec="libx264",
            audio_codec="aac",
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Video creation failed: {exc}",
        )

    finally:
        try:
            if final_video:
                final_video.close()
        except Exception:
            pass

        for clip in clips:
            try:
                clip.close()
            except Exception:
                pass

    return {
        "success": True,
        "video_path": str(video_path),
        "video_url": f"/generated_videos/{video_filename}",
    }


@app.post("/generate-voiceover")
async def generate_voiceover(request: VoiceoverRequest):
    if not request.scenes:
        raise HTTPException(status_code=400, detail="Scenes are required.")

    voiceover_text = build_voiceover_text(request.scenes)

    audio_path, audio_url = await generate_voiceover_audio(
        text=voiceover_text,
        language=request.language,
    )

    return {
        "success": True,
        "voiceover_text": voiceover_text,
        "audio_path": audio_path,
        "audio_url": audio_url,
    }


@app.post("/add-voiceover-to-video")
async def add_voiceover_to_video(request: AddVoiceoverRequest):
    if not request.video_path:
        raise HTTPException(status_code=400, detail="video_path is required.")

    if not request.scenes:
        raise HTTPException(status_code=400, detail="Scenes are required.")

    voiceover_text = build_voiceover_text(request.scenes)

    audio_path, audio_url = await generate_voiceover_audio(
        text=voiceover_text,
        language=request.language,
    )

    final_video_path, final_video_url = add_audio_to_video(
        video_path=request.video_path,
        audio_path=audio_path,
    )

    return {
        "success": True,
        "voiceover_text": voiceover_text,
        "audio_path": audio_path,
        "audio_url": audio_url,
        "final_video_path": final_video_path,
        "final_video_url": final_video_url,
    }


@app.post("/create-synced-video")
async def create_synced_video(request: SyncedVideoRequest):
    if not request.scenes:
        raise HTTPException(status_code=400, detail="Scenes are required.")

    clips = []

    for index, scene in enumerate(request.scenes):
        image_base64 = scene.get("image_base64")

        voiceover_text = (
            scene.get("voiceover")
            or scene.get("dialogue")
            or scene.get("description")
            or ""
        )

        if not image_base64:
            raise HTTPException(
                status_code=400,
                detail=f"image_base64 missing for scene {index + 1}",
            )

        if not voiceover_text.strip():
            raise HTTPException(
                status_code=400,
                detail=f"voiceover missing for scene {index + 1}",
            )

        image_path = TEMP_IMAGES_DIR / f"synced_scene_{uuid.uuid4().hex}_{index + 1}.png"

        try:
            with open(image_path, "wb") as file:
                file.write(base64.b64decode(image_base64))
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid base64 image for scene {index + 1}: {exc}",
            )

        audio_path, audio_url = await generate_voiceover_audio(
            text=voiceover_text,
            language=request.language,
        )

        audio_clip = AudioFileClip(audio_path)

        try:
            image_clip = ImageClip(str(image_path)).with_duration(audio_clip.duration)
            image_clip = image_clip.with_audio(audio_clip)
        except AttributeError:
            image_clip = ImageClip(str(image_path)).set_duration(audio_clip.duration)
            image_clip = image_clip.set_audio(audio_clip)

        clips.append(image_clip)

    if not clips:
        raise HTTPException(status_code=400, detail="No valid scene clips found.")

    final_filename = f"synced_video_{uuid.uuid4().hex}.mp4"
    final_path = GENERATED_VIDEOS_DIR / final_filename

    final_video = None

    try:
        final_video = concatenate_videoclips(clips, method="compose")

        final_video.write_videofile(
            str(final_path),
            fps=24,
            codec="libx264",
            audio_codec="aac",
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Synced video creation failed: {exc}",
        )

    finally:
        try:
            if final_video:
                final_video.close()
        except Exception:
            pass

        for clip in clips:
            try:
                clip.close()
            except Exception:
                pass

    return {
        "success": True,
        "video_path": str(final_path),
        "video_url": f"/generated_videos/{final_filename}",
    }