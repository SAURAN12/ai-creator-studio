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
