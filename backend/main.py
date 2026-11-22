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
