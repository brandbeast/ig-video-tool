const fileInput = document.getElementById('fileInput');
const createBtn = document.getElementById('createBtn');
const preview = document.getElementById('preview');
const status = document.getElementById('status');

let files = [];

fileInput.addEventListener('change', async (e) => {
  const selected = Array.from(e.target.files);
  preview.innerHTML = '';
  files = [];

  for (const file of selected) {
    if (file.name.endsWith('.heic')) {
      try {
        const blob = await heic2any({ blob: file, toType: 'image/jpeg' });
        const converted = new File([blob], file.name.replace(/\.heic$/, '.jpg'), { type: 'image/jpeg' });
        files.push(converted);

        // Use FileReader for base64 preview (fixes .heic preview issues)
        const reader = new FileReader();
        reader.onload = function(event) {
          const img = document.createElement('img');
          img.src = event.target.result;
          preview.appendChild(img);
        };
        reader.readAsDataURL(converted);
      } catch (err) {
        console.error("HEIC conversion error:", err);
        status.textContent = "❌ Failed to convert .heic file.";
      }
    } else if (file.type.startsWith('image/')) {
      files.push(file);
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      preview.appendChild(img);
    }
  }
});

createBtn.addEventListener('click', async () => {
  if (!files.length) return alert("Upload at least one image");

  const { createFFmpeg, fetchFile } = window.FFmpeg;
  const ffmpeg = createFFmpeg({
    log: true,
    corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js"
  });

  status.textContent = "⚙️ Loading video engine...";
  await ffmpeg.load();

  for (let i = 0; i < files.length; i++) {
    const arrayBuffer = await files[i].arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    ffmpeg.FS('writeFile', `img${i}.jpg`, uint8Array);
  }

  const inputs = [];
  const filters = [];

  for (let i = 0; i < files.length; i++) {
    inputs.push("-loop", "1", "-t", "3", "-i", `img${i}.jpg`);
    filters.push(`[${i}:v]scale=1080:1920[v${i}]`);
  }

  const filterComplex = filters.join(';') + ';' +
    files.map((_, i) => `[v${i}]`).join('') +
    `concat=n=${files.length}:v=1:a=0[out]`;

  try {
    status.textContent = "🎬 Rendering video (30–60 seconds)...";
    await ffmpeg.run(
      ...inputs,
      "-filter_complex", filterComplex,
      "-map", "[out]",
      "-preset", "ultrafast",
      "output.mp4"
    );

    const data = ffmpeg.FS('readFile', 'output.mp4');
    const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

    const a = document.createElement('a');
    a.href = url;
    a.download = 'video.mp4';
    a.textContent = "⬇️ Download Your Video";
    a.style.display = "block";
    a.style.marginTop = "20px";
    document.body.appendChild(a);

    status.textContent = "✅ Done!";
  } catch (err) {
    console.error("Render failed:", err);
    status.textContent = "❌ Failed to render video.";
  }
});