import { useState } from "react";
import "./App.css";

// Backend URL: set VITE_API_URL in Vercel → Settings → Environment Variables
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const imageStyleOptions = [
  "Cinematic Realistic",
  "Pixar 3D Cartoon",
  "Anime",
  "Watercolor",
  "Dark Horror Art",
];

// Builds a usable <img>/<video> src from whatever the backend returns
function toMediaSrc(value) {
  if (!value) return "";
  if (value.startsWith("http") || value.startsWith("data:")) return value;
  if (value.startsWith("/")) return `${API_URL}${value}`;
  return `data:image/png;base64,${value}`;
}

async function postJSON(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json();
}

function App() {
  const [activeTab, setActiveTab] = useState("story");

  // Shared inputs
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("Hindi Horror");
  const [imageStyle, setImageStyle] = useState(imageStyleOptions[0]);
  const [mood, setMood] = useState("Scary and dramatic");

  // Story tab
  const [storyIdea, setStoryIdea] = useState("");
  const [sceneCount, setSceneCount] = useState(5);
  const [story, setStory] = useState("");
  const [scenes, setScenes] = useState([]);
  const [videoPath, setVideoPath] = useState("");
  const [finalVideoPath, setFinalVideoPath] = useState("");
  const [voiceoverText, setVoiceoverText] = useState("");

  // Thumbnail tab
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
      setError(err.message || "Something went wrong");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const generateStory = () =>
    run("Writing your story...", async () => {
      const data = await postJSON("/generate-story", {
        idea: storyIdea,
        title,
        style,
        mood,
        scene_count: Number(sceneCount),
      });
      setStory(data.story || "");
      setScenes([]);
      setVideoPath("");
      setFinalVideoPath("");
      setVoiceoverText("");
    });

  const generateScenes = () =>
    run("Generating scene images...", async () => {
      const data = await postJSON("/generate-scenes", {
        story,
        style,
        image_style: imageStyle,
        mood,
        scene_count: Number(sceneCount),
      });
      setScenes(data.scenes || []);
    });

  const createVideo = () =>
    run("Creating video from scenes...", async () => {
      const data = await postJSON("/create-video", { scenes });
      setVideoPath(toMediaSrc(data.video_path));
    });

  const createFinalVideo = () =>
    run("Adding voiceover and syncing...", async () => {
      const data = await postJSON("/create-final-video", { story, scenes });
      setFinalVideoPath(toMediaSrc(data.final_video_path));
      setVoiceoverText(data.voiceover_text || "");
    });

  const generateThumbnail = () =>
    run("Generating AI thumbnail...", async () => {
      const data = await postJSON("/generate-thumbnail", {
        title,
        style,
        image_style: imageStyle,
        mood,
      });
      setThumbnail(toMediaSrc(data.thumbnail));
    });

  return (
    <div className="app">
      <h1>AI Creator Studio</h1>

      <div className="tabs">
        <button
          className={activeTab === "story" ? "active" : ""}
          onClick={() => setActiveTab("story")}
        >
          Story Video
        </button>
        <button
          className={activeTab === "thumbnail" ? "active" : ""}
          onClick={() => setActiveTab("thumbnail")}
        >
          Thumbnail
        </button>
      </div>

      {activeTab === "story" && (
        <div className="card">
          <h2>Create Story Video</h2>

          <label>Video Title</label>
          <input
            type="text"
            placeholder="Rudra Villa: The Night Nobody Returned"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label>Story Idea</label>
          <textarea
            rows={4}
            placeholder="A family moves into an old villa where nobody returns after midnight..."
            value={storyIdea}
            onChange={(e) => setStoryIdea(e.target.value)}
          />

          <label>Story Category</label>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option>Hindi Horror</option>
            <option>Kids Story</option>
            <option>Pixar 3D Cartoon</option>
            <option>Anime</option>
            <option>Gaming</option>
            <option>Village Story</option>
          </select>

          <label>Image Style Mode</label>
          <select
            value={imageStyle}
            onChange={(e) => setImageStyle(e.target.value)}
          >
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

          <label>Number of Scenes</label>
          <input
            type="number"
            min={1}
            max={20}
            value={sceneCount}
            onChange={(e) => setSceneCount(e.target.value)}
          />

          <button onClick={generateStory} disabled={loading || !storyIdea}>
            {loading ? "Working..." : "1. Generate Story"}
          </button>

          {story && (
            <div className="result">
              <h3>Story</h3>
              <pre>{story}</pre>

              <button onClick={generateScenes} disabled={loading}>
                2. Generate Scene Images
              </button>
            </div>
          )}

          {scenes.length > 0 && (
            <div className="result">
              <h3>Scene Images</h3>

              {scenes.map((item) => {
                const imageSrc = toMediaSrc(item.image_url || item.image);

                return (
                  <div key={item.scene_number} className="scene-item">
                    <h4>
                      Scene {item.scene_number}: {item.scene_title}
                    </h4>
                    <img src={imageSrc} alt={item.scene_title} />

                    <a href={imageSrc} download={`scene-${item.scene_number}.png`}>
                      <button>Download Scene {item.scene_number}</button>
                    </a>
                  </div>
                );
              })}

              <button onClick={createVideo} disabled={loading}>
                3. Create Video
              </button>
            </div>
          )}

          {videoPath && (
            <div className="result">
              <h3>Video Without Voiceover</h3>

              <video src={videoPath} controls width="100%" />

              <a href={videoPath} download="story-video.mp4">
                <button>Download Video</button>
              </a>

              <button onClick={createFinalVideo} disabled={loading}>
                4. Add Voiceover and Sync
              </button>
            </div>
          )}

          {finalVideoPath && (
            <div className="result final-video-box">
              <h3>Final Synced Video With Voiceover</h3>

              <video src={finalVideoPath} controls width="100%" />

              <a href={finalVideoPath} download="synced-story-video.mp4">
                <button>Download Synced Video</button>
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
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option>Hindi Horror</option>
            <option>Kids Story</option>
            <option>Pixar 3D Cartoon</option>
            <option>Anime</option>
            <option>Gaming</option>
            <option>Village Story</option>
          </select>

          <label>Image Style Mode</label>
          <select
            value={imageStyle}
            onChange={(e) => setImageStyle(e.target.value)}
          >
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

          <button onClick={generateThumbnail} disabled={loading || !title}>
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
