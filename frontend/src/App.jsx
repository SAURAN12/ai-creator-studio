import { useState } from "react";
import "./App.css";

// Backend URL: set VITE_API_URL in Vercel → Settings → Environment Variables
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

const imageStyleOptions = [
  "3D Animated Movie",
  "Cinematic Realistic",
  "Pixar 3D Cartoon",
  "Anime",
  "Watercolor",
  "Dark Horror Art",
];

// image_base64 -> data URI; "/generated_videos/x.mp4" -> full backend URL
const imageSrc = (b64) => (b64 ? `data:image/png;base64,${b64}` : "");
const mediaUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

async function postJSON(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.detail) message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* response was not JSON */
    }
    throw new Error(message);
  }
  return res.json();
}

function App() {
  const [activeTab, setActiveTab] = useState("story");

  // Story inputs (match backend StoryRequest)
  const [genre, setGenre] = useState("Hindi Horror");
  const [characters, setCharacters] = useState("");
  const [moral, setMoral] = useState("");
  const [duration, setDuration] = useState("2 minute");
  const [language, setLanguage] = useState("Hindi");
  const [imageStyle, setImageStyle] = useState(imageStyleOptions[0]);

  // Scene source: from the story inputs, or from your own dialogue
  const [sceneSource, setSceneSource] = useState("story");
  const [dialogue, setDialogue] = useState("");

  // Story outputs
  const [story, setStory] = useState("");
  const [scenes, setScenes] = useState([]); // prompts from /generate-scenes
  const [images, setImages] = useState([]); // scenes with image_base64
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPath, setVideoPath] = useState(""); // server path, needed for voiceover
  const [finalVideoUrl, setFinalVideoUrl] = useState("");
  const [voiceoverText, setVoiceoverText] = useState("");

  // Thumbnail inputs (match backend ThumbnailRequest)
  const [title, setTitle] = useState("");
  const [thumbStyle, setThumbStyle] = useState("Hindi Horror");
  const [mood, setMood] = useState("Scary and dramatic");
  const [thumbnail, setThumbnail] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const run = async (label, task) => {
    setLoading(true);
    setError("");
    setStatus(label);
    try {
      await task();
      setStatus("Done!");
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? `Cannot reach the backend at ${API_URL}. Check that it is running and that VITE_API_URL is set.`
          : err.message
      );
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const storyBody = () => ({ genre, characters, moral, duration, language });

  const resetMedia = () => {
    setImages([]);
    setVideoUrl("");
    setVideoPath("");
    setFinalVideoUrl("");
    setVoiceoverText("");
  };

  // 1. Story
  const generateStory = () =>
    run("Writing your story...", async () => {
      const data = await postJSON("/generate-story", storyBody());
      setStory(data.story || "");
    });

  // 2. Scene prompts
  const generateScenes = () =>
    run("Creating scene prompts...", async () => {
      const data =
        sceneSource === "dialogue"
          ? await postJSON("/generate-scenes-from-dialogue", { dialogue, language })
          : await postJSON("/generate-scenes", storyBody());
      setScenes(data.scenes || []);
      resetMedia();
    });

  // 3. Scene images (adds the chosen image style to each prompt)
  const generateSceneImages = () =>
    run("Generating scene images (this can take a minute)...", async () => {
      const styled = scenes.map((s) => ({
        ...s,
        visual_prompt: `${s.visual_prompt}. Art style: ${imageStyle}.`,
      }));
      const data = await postJSON("/generate-scene-images", { scenes: styled });
      setImages(data.images || []);
      setVideoUrl("");
      setVideoPath("");
      setFinalVideoUrl("");
    });

  // 4a. Video without voiceover
  const createVideo = () =>
    run("Creating video from images...", async () => {
      const data = await postJSON("/create-video-from-images", { scenes: images });
      setVideoUrl(mediaUrl(data.video_url));
      setVideoPath(data.video_path || "");
    });

  // 4b. Final video synced scene-by-scene with voiceover
  const createSyncedVideo = () =>
    run("Creating synced video with voiceover...", async () => {
      const data = await postJSON("/create-synced-video", { scenes: images, language });
      setFinalVideoUrl(mediaUrl(data.video_url));
      setVoiceoverText(
        images
          .map((s) => `Scene ${s.scene_number}: ${s.voiceover || s.dialogue || s.description || ""}`)
          .join("\n\n")
      );
    });

  // 4c. Add one voiceover track to the existing video
  const addVoiceover = () =>
    run("Adding voiceover to video...", async () => {
      const data = await postJSON("/add-voiceover-to-video", {
        video_path: videoPath,
        scenes: images,
        language,
      });
      setFinalVideoUrl(mediaUrl(data.final_video_url));
      setVoiceoverText(data.voiceover_text || "");
    });

  // Thumbnail
  const generateThumbnail = () =>
    run("Generating AI thumbnail...", async () => {
      const data = await postJSON("/generate-thumbnail", {
        title,
        style: `${thumbStyle}, ${imageStyle}`,
        mood,
      });
      setThumbnail(imageSrc(data.image_base64));
    });

  const canStory = characters.trim() && moral.trim();

  return (
    <div className="app">
      <h1>AI Creator Studio</h1>

      <div className="tabs">
        <button className={activeTab === "story" ? "active" : ""} onClick={() => setActiveTab("story")}>
          Story Video
        </button>
        <button className={activeTab === "thumbnail" ? "active" : ""} onClick={() => setActiveTab("thumbnail")}>
          Thumbnail
        </button>
      </div>

      {activeTab === "story" && (
        <div className="card">
          <h2>Create Story Video</h2>

          <label>Genre</label>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option>Hindi Horror</option>
            <option>Kids Story</option>
            <option>Pixar 3D Cartoon</option>
            <option>Anime</option>
            <option>Gaming</option>
            <option>Village Story</option>
          </select>

          <label>Characters</label>
          <input
            type="text"
            placeholder="Rudra, his sister Meera, an old watchman"
            value={characters}
            onChange={(e) => setCharacters(e.target.value)}
          />

          <label>Moral</label>
          <input
            type="text"
            placeholder="Never ignore a warning"
            value={moral}
            onChange={(e) => setMoral(e.target.value)}
          />

          <label>Duration</label>
          <select value={duration} onChange={(e) => setDuration(e.target.value)}>
            <option>1 minute</option>
            <option>2 minute</option>
            <option>5 minute</option>
            <option>10 minute</option>
          </select>

          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option>Hindi</option>
            <option>English</option>
          </select>

          <label>Image Style Mode</label>
          <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)}>
            {imageStyleOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>

          <button onClick={generateStory} disabled={loading || !canStory}>
            {loading ? "Working..." : "1. Generate Story"}
          </button>

          {story && (
            <div className="result">
              <h3>Story</h3>
              <pre>{story}</pre>
            </div>
          )}

          <div className="result">
            <h3>2. Scene Prompts</h3>

            <label>Create scenes from</label>
            <select value={sceneSource} onChange={(e) => setSceneSource(e.target.value)}>
              <option value="story">The story settings above</option>
              <option value="dialogue">My own dialogue</option>
            </select>

            {sceneSource === "dialogue" && (
              <textarea
                rows={6}
                placeholder="Paste your dialogue or script here..."
                value={dialogue}
                onChange={(e) => setDialogue(e.target.value)}
              />
            )}

            <button
              onClick={generateScenes}
              disabled={loading || (sceneSource === "story" ? !canStory : !dialogue.trim())}
            >
              Generate Scene Prompts
            </button>

            {scenes.length > 0 && (
              <>
                <ol className="scene-list">
                  {scenes.map((s) => (
                    <li key={s.scene_number}>
                      <strong>{s.scene_title}</strong> — {s.description}
                    </li>
                  ))}
                </ol>

                <button onClick={generateSceneImages} disabled={loading}>
                  3. Generate Scene Images
                </button>
              </>
            )}
          </div>

          {images.length > 0 && (
            <div className="result">
              <h3>Scene Images</h3>

              {images.map((item) => {
                const src = imageSrc(item.image_base64);

                return (
                  <div key={item.scene_number} className="scene-item">
                    <h4>
                      Scene {item.scene_number}: {item.scene_title}
                    </h4>
                    <img src={src} alt={item.scene_title} />

                    <a href={src} download={`scene-${item.scene_number}.png`}>
                      <button>Download Scene {item.scene_number}</button>
                    </a>
                  </div>
                );
              })}

              <button onClick={createVideo} disabled={loading}>
                4. Create Video (no voiceover)
              </button>
              <button onClick={createSyncedVideo} disabled={loading}>
                4. Create Synced Video with Voiceover
              </button>
            </div>
          )}

          {videoUrl && (
            <div className="result">
              <h3>Video Without Voiceover</h3>

              <video src={videoUrl} controls width="100%" />

              <a href={videoUrl} download="story-video.mp4">
                <button>Download Video</button>
              </a>

              <button onClick={addVoiceover} disabled={loading || !videoPath}>
                Add Voiceover to This Video
              </button>
            </div>
          )}

          {finalVideoUrl && (
            <div className="result final-video-box">
              <h3>Final Video With Voiceover</h3>

              <video src={finalVideoUrl} controls width="100%" />

              <a href={finalVideoUrl} download="synced-story-video.mp4">
                <button>Download Final Video</button>
              </a>

              {voiceoverText && (
                <div className="voiceover-box">
                  <h3>Scene-by-Scene Voiceover Text</h3>
                  <pre>{voiceoverText}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "thumbnail" && (
        <div className="card">
          <h2>Generate YouTube Thumbnail</h2>

          <label>Video Title</label>
          <input
            type="text"
            placeholder="Rudra Villa: The Night Nobody Returned"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label>Thumbnail Category</label>
          <select value={thumbStyle} onChange={(e) => setThumbStyle(e.target.value)}>
            <option>Hindi Horror</option>
            <option>Kids Story</option>
            <option>Pixar 3D Cartoon</option>
            <option>Anime</option>
            <option>Gaming</option>
            <option>Village Story</option>
          </select>

          <label>Image Style Mode</label>
          <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)}>
            {imageStyleOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>

          <label>Mood</label>
          <select value={mood} onChange={(e) => setMood(e.target.value)}>
            <option>Scary and dramatic</option>
            <option>Emotional and heartwarming</option>
            <option>Mysterious and cinematic</option>
            <option>Funny and colorful</option>
          </select>

          <button onClick={generateThumbnail} disabled={loading || !title.trim()}>
            {loading ? "Generating AI Thumbnail..." : "Generate Thumbnail"}
          </button>

          {thumbnail && (
            <div className="result">
              <img src={thumbnail} alt="Generated thumbnail" />

              <a href={thumbnail} download="thumbnail.png">
                <button>Download Thumbnail</button>
              </a>
            </div>
          )}
        </div>
      )}

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default App;
