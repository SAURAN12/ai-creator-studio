import { useState } from "react";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState("story");

  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("Hindi Horror");
  const [mood, setMood] = useState("Scary and dramatic");
  const [thumbnail, setThumbnail] = useState("");

  const [genre, setGenre] = useState("Kids Story");
  const [characters, setCharacters] = useState("");
  const [moral, setMoral] = useState("");
  const [duration, setDuration] = useState("2 minutes");
  const [language, setLanguage] = useState("Hindi");
  const [story, setStory] = useState("");

  const [sceneData, setSceneData] = useState(null);
  const [sceneImages, setSceneImages] = useState([]);

  const [videoPath, setVideoPath] = useState("");
  const [backendVideoPath, setBackendVideoPath] = useState("");
  const [finalVideoPath, setFinalVideoPath] = useState("");
  const [voiceoverText, setVoiceoverText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const apiCall = async (endpoint, payload) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Something went wrong");
    }

    return data;
  };

  const generateThumbnail = async () => {
    if (!title.trim()) {
      setError("Please enter a video title.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setStatus("");
      setThumbnail("");

      const data = await apiCall("/generate-thumbnail", {
        title,
        style,
        mood,
      });

      setThumbnail(`data:image/png;base64,${data.image_base64}`);
      setStatus("Thumbnail generated successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateStory = async () => {
    if (!characters.trim()) {
      setError("Please enter characters.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setStatus("Generating story...");
      setStory("");

      const data = await apiCall("/generate-story", {
        genre,
        characters,
        moral,
        duration,
        language,
      });

      setStory(data.story);
      setStatus("Story generated successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateScenes = async () => {
    if (!characters.trim()) {
      setError("Please enter characters.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setStatus("Generating scenes...");

      const data = await apiCall("/generate-scenes", {
        genre,
        characters,
        moral,
        duration,
        language,
      });

      setSceneData(data);
      setSceneImages([]);
      setVideoPath("");
      setBackendVideoPath("");
      setFinalVideoPath("");
      setVoiceoverText("");

      setStatus("Scenes generated successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSceneImages = async () => {
    if (!sceneData?.scenes?.length) {
      setError("Please generate scenes first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setStatus("Generating scene images...");
      setSceneImages([]);
      setVideoPath("");
      setBackendVideoPath("");
      setFinalVideoPath("");
      setVoiceoverText("");

      const data = await apiCall("/generate-scene-images", {
        scenes: sceneData.scenes,
      });

      setSceneImages(data.images || []);
      setStatus("Images generated successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createVideoFromImages = async () => {
    if (!sceneImages.length) {
      setError("Please generate images first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setStatus("Creating video without voiceover...");
      setVideoPath("");
      setBackendVideoPath("");
      setFinalVideoPath("");
      setVoiceoverText("");

      const scenesWithDuration = sceneImages.map((image, index) => ({
        ...image,
        duration_seconds: sceneData?.scenes?.[index]?.duration_seconds || 4,
      }));

      const data = await apiCall("/create-video-from-images", {
        scenes: scenesWithDuration,
      });

      setBackendVideoPath(data.video_path);

      const path = data.video_url
        ? `${API_BASE}${data.video_url}`
        : `${API_BASE}/${data.video_path}`;

      setVideoPath(path);
      setStatus("Video without voiceover created successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createSyncedVideoWithVoiceover = async () => {
    if (!sceneImages.length) {
      setError("Please generate images first.");
      return;
    }

    if (!sceneData?.scenes?.length) {
      setError("Scenes are required for voiceover.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setStatus("Creating synced video with scene-by-scene voiceover...");
      setFinalVideoPath("");
      setVoiceoverText("");

      const syncedScenes = sceneImages.map((image, index) => ({
        ...image,
        voiceover: sceneData?.scenes?.[index]?.voiceover || "",
        dialogue: sceneData?.scenes?.[index]?.dialogue || "",
        description: sceneData?.scenes?.[index]?.description || "",
        duration_seconds: sceneData?.scenes?.[index]?.duration_seconds || 4,
      }));

      const data = await apiCall("/create-synced-video", {
        scenes: syncedScenes,
        language,
      });

      const allVoiceoverText = syncedScenes
        .map(
          (scene, index) =>
            `Scene ${index + 1}: ${
              scene.voiceover || scene.dialogue || scene.description
            }`
        )
        .join("\n\n");

      setVoiceoverText(allVoiceoverText);

      const finalPath = data.video_url
        ? `${API_BASE}${data.video_url}`
        : `${API_BASE}/${data.video_path}`;

      setFinalVideoPath(finalPath);
      setStatus("Synced video with scene-by-scene voiceover created successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const commonStoryFields = (
    <>
      <label>Genre</label>
      <select value={genre} onChange={(e) => setGenre(e.target.value)}>
        <option>Kids Story</option>
        <option>Horror</option>
        <option>Village Story</option>
        <option>Fantasy</option>
        <option>Adventure</option>
      </select>

      <label>Characters</label>
      <input
        type="text"
        placeholder="Duck, Squirrel, Farmer"
        value={characters}
        onChange={(e) => setCharacters(e.target.value)}
      />

      <label>Moral</label>
      <input
        type="text"
        placeholder="Helping others"
        value={moral}
        onChange={(e) => setMoral(e.target.value)}
      />

      <label>Duration</label>
      <select value={duration} onChange={(e) => setDuration(e.target.value)}>
        <option>1 minute</option>
        <option>2 minutes</option>
        <option>5 minutes</option>
      </select>

      <label>Language</label>
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option>Hindi</option>
        <option>English</option>
      </select>
    </>
  );

  return (
    <div className="app">
      <div className="hero">
        <h1>AI Creator Studio</h1>
        <p>Generate stories, scenes, images, videos, and YouTube thumbnails.</p>
      </div>

      <div className="tabs">
        <button
          className={activeTab === "story" ? "active" : ""}
          onClick={() => setActiveTab("story")}
        >
          Story
        </button>

        <button
          className={activeTab === "scene" ? "active" : ""}
          onClick={() => setActiveTab("scene")}
        >
          Scenes
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
          <h2>Generate Story</h2>

          {commonStoryFields}

          <button onClick={generateStory} disabled={loading}>
            {loading ? "Generating Story..." : "Generate Story"}
          </button>

          {story && (
            <div className="story-box">
              <h3>Generated Story</h3>
              <pre>{story}</pre>
            </div>
          )}
        </div>
      )}

      {activeTab === "scene" && (
        <div className="card">
          <h2>Generate Scenes and Images</h2>

          {commonStoryFields}

          <button onClick={generateScenes} disabled={loading}>
            {loading ? "Generating Scenes..." : "Generate Scenes"}
          </button>

          <button
            onClick={generateSceneImages}
            disabled={loading || !sceneData?.scenes?.length}
          >
            {loading ? "Generating Images..." : "Generate Images for Scenes"}
          </button>

          <button
            onClick={createVideoFromImages}
            disabled={loading || !sceneImages.length}
          >
            {loading ? "Creating Video..." : "Create Video Without Voiceover"}
          </button>

          <button
            onClick={createSyncedVideoWithVoiceover}
            disabled={loading || !sceneImages.length}
          >
            {loading
              ? "Creating Synced Video..."
              : "Create Synced Video with Voiceover"}
          </button>

          {sceneData?.scenes?.map((scene) => (
            <div key={scene.scene_number} className="story-box">
              <h3>
                Scene {scene.scene_number}: {scene.scene_title}
              </h3>

              <p>
                <strong>Description:</strong> {scene.description}
              </p>

              <p>
                <strong>Visual Prompt:</strong> {scene.visual_prompt}
              </p>

              <p>
                <strong>Camera Angle:</strong> {scene.camera_angle}
              </p>

              <p>
                <strong>Voiceover:</strong> {scene.voiceover}
              </p>

              <p>
                <strong>Duration:</strong> {scene.duration_seconds} sec
              </p>
            </div>
          ))}

          {sceneImages.length > 0 && (
            <div className="image-grid">
              {sceneImages.map((item) => {
                const imageSrc = `data:image/png;base64,${item.image_base64}`;

                return (
                  <div key={item.scene_number} className="image-card">
                    <h3>
                      Scene {item.scene_number}: {item.scene_title}
                    </h3>

                    <img src={imageSrc} alt={item.scene_title} />

                    <a href={imageSrc} download={`scene-${item.scene_number}.png`}>
                      <button>Download Scene {item.scene_number}</button>
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {videoPath && (
            <div className="result">
              <h3>Video Without Voiceover</h3>

              <video src={videoPath} controls width="100%" />

              <a href={videoPath} download="story-video.mp4">
                <button>Download Video</button>
              </a>
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

          <label>Style</label>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option>Hindi Horror</option>
            <option>Kids Story</option>
            <option>Pixar 3D Cartoon</option>
            <option>Anime</option>
            <option>Gaming</option>
            <option>Village Story</option>
          </select>

          <label>Mood</label>
          <select value={mood} onChange={(e) => setMood(e.target.value)}>
            <option>Scary and dramatic</option>
            <option>Emotional and heartwarming</option>
            <option>Mysterious and cinematic</option>
            <option>Funny and colorful</option>
          </select>

          <button onClick={generateThumbnail} disabled={loading}>
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