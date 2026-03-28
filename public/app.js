/**
 * Glass Wizard Music NFT Studio – client-side application
 *
 * Uses the Web Audio API for playback and the REST API (src/server.ts)
 * for music generation and XRPL operations.
 */

/* ── State ───────────────────────────────────────────────────────────────── */

let currentTrack = null;     // MusicTrack from the server
let currentWallet = null;    // { address, seed, publicKey }
let audioCtx = null;         // Web AudioContext
let playbackNodes = [];      // OscillatorNode[] currently scheduled
let isPlaying = false;

/* ── DOM helpers ─────────────────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

function show(id)  { $(id).classList.remove("hidden"); }
function hide(id)  { $(id).classList.add("hidden");    }
function enable(id)  { $(id).disabled = false; }
function disable(id) { $(id).disabled = true;  }

/* ── Wallet ──────────────────────────────────────────────────────────────── */

$("btn-create-wallet").addEventListener("click", async () => {
  $("btn-create-wallet").textContent = "Creating…";
  $("btn-create-wallet").disabled = true;
  $("wallet-status").textContent = "Requesting Testnet funds (may take 30s)…";

  try {
    const res = await fetch("/api/wallet/create", { method: "POST" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    applyWallet(data.wallet);
  } catch (err) {
    $("wallet-status").textContent = `Error: ${err.message}`;
  } finally {
    $("btn-create-wallet").textContent = "Create Testnet Wallet";
    $("btn-create-wallet").disabled = false;
  }
});

$("btn-load-wallet").addEventListener("click", () => {
  $("seed-input-area").classList.toggle("hidden");
});

$("btn-confirm-seed").addEventListener("click", async () => {
  const seed = $("seed-input").value.trim();
  if (!seed) return;
  try {
    const res = await fetch("/api/wallet/from-seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    applyWallet({ ...data.wallet, seed });
  } catch (err) {
    alert(`Could not load wallet: ${err.message}`);
  }
});

function applyWallet(walletInfo) {
  currentWallet = walletInfo;
  $("wallet-address").textContent = walletInfo.address;
  $("wallet-balance").textContent = "loading…";
  $("wallet-status").textContent = "Wallet connected ✓";
  $("wallet-explorer-link").href =
    `https://testnet.xrpl.org/accounts/${walletInfo.address}`;
  show("wallet-details");
  hide("seed-input-area");

  enable("btn-mint");
  enable("btn-load-nfts");
  updateMintButton();

  // Fetch balance (in drops → convert to XRP)
  fetch(`/api/wallet/${walletInfo.address}/balance`)
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        $("wallet-balance").textContent =
          (Number(d.balance) / 1_000_000).toFixed(2);
      }
    })
    .catch(() => { $("wallet-balance").textContent = "?"; });
}

/* ── Music generation ────────────────────────────────────────────────────── */

$("btn-generate").addEventListener("click", async () => {
  stopPlayback();
  $("btn-generate").textContent = "Generating…";
  $("btn-generate").disabled = true;

  try {
    const res = await fetch("/api/music/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        style: $("style-select").value,
        scale: $("scale-select").value,
        bars:  Number($("bars-input").value),
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    currentTrack = data.track;
    displayTrack(currentTrack);
    updateMintButton();
  } catch (err) {
    alert(`Generation failed: ${err.message}`);
  } finally {
    $("btn-generate").textContent = "✨ Generate Track";
    $("btn-generate").disabled = false;
  }
});

function displayTrack(track) {
  show("track-info");
  show("btn-play");
  hide("btn-stop");

  $("track-name").textContent = track.name;
  $("track-tempo").textContent = `${track.tempo} BPM`;
  $("track-scale").textContent = track.scale.replace("_", " ");
  $("track-notes").textContent = `${track.notes.length} notes`;

  drawPianoRoll(track);
}

/* ── Piano roll visualiser ───────────────────────────────────────────────── */

function drawPianoRoll(track) {
  const canvas = $("piano-roll");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (!track.notes.length) return;

  const pitches = track.notes.map(n => n.pitch);
  const minP = Math.min(...pitches) - 1;
  const maxP = Math.max(...pitches) + 1;
  const totalBeats = track.totalBeats || 1;

  const noteHeight = Math.max(2, H / (maxP - minP + 1));
  const pxPerBeat  = W / totalBeats;

  // Background grid
  ctx.fillStyle = "#1f1f38";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#2d2d4e";
  ctx.lineWidth = 1;
  for (let b = 0; b <= totalBeats; b++) {
    const x = Math.floor(b * pxPerBeat);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Notes
  track.notes.forEach(note => {
    const x = note.startTime * pxPerBeat;
    const y = H - ((note.pitch - minP) / (maxP - minP + 1)) * H;
    const w = Math.max(1, note.duration * pxPerBeat - 1);
    const alpha = 0.55 + (note.velocity / 127) * 0.45;

    ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
    ctx.beginPath();
    ctx.roundRect(x, y - noteHeight / 2, w, noteHeight, 2);
    ctx.fill();
  });
}

/* ── Playback (Web Audio API) ────────────────────────────────────────────── */

$("btn-play").addEventListener("click", () => {
  if (!currentTrack) return;
  startPlayback(currentTrack);
});

$("btn-stop").addEventListener("click", stopPlayback);

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function startPlayback(track) {
  stopPlayback();
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();

  const bps = track.tempo / 60;
  const now = audioCtx.currentTime + 0.1;

  playbackNodes = [];
  isPlaying = true;
  hide("btn-play");
  show("btn-stop");

  track.notes.forEach(note => {
    const startSec = now + note.startTime / bps;
    const durSec   = note.duration / bps;

    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "triangle";
    osc.frequency.value = midiToFreq(note.pitch);
    gain.gain.setValueAtTime(0, startSec);
    gain.gain.linearRampToValueAtTime(note.velocity / 127 * 0.3, startSec + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startSec + durSec);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startSec);
    osc.stop(startSec + durSec + 0.05);
    playbackNodes.push(osc);
  });

  // Auto-stop UI after track finishes
  const totalSec = (track.totalBeats / bps) * 1000 + 200;
  setTimeout(() => {
    if (isPlaying) resetPlaybackUI();
  }, totalSec);
}

function stopPlayback() {
  playbackNodes.forEach(n => { try { n.stop(); } catch { /* already stopped */ } });
  playbackNodes = [];
  isPlaying = false;
  resetPlaybackUI();
}

function resetPlaybackUI() {
  isPlaying = false;
  show("btn-play");
  hide("btn-stop");
}

/* ── NFT Minting ─────────────────────────────────────────────────────────── */

$("btn-mint").addEventListener("click", async () => {
  if (!currentTrack || !currentWallet) return;

  $("btn-mint").textContent = "Minting…";
  $("btn-mint").disabled = true;
  hide("mint-result");

  try {
    const res = await fetch("/api/nft/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seed:        currentWallet.seed,
        track:       currentTrack,
        transferFee: Number($("transfer-fee").value),
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    $("nft-token-id").textContent = data.nftTokenId;
    $("nft-explorer-link").href =
      `https://testnet.xrpl.org/nft/${data.nftTokenId}`;
    show("mint-result");

    // Reload NFT list
    loadNFTs();
  } catch (err) {
    alert(`Minting failed: ${err.message}`);
  } finally {
    $("btn-mint").textContent = "🔨 Mint NFT on XRPL";
    updateMintButton();
  }
});

function updateMintButton() {
  const canMint = currentTrack && currentWallet;
  $("btn-mint").disabled = !canMint;
}

/* ── NFT List ────────────────────────────────────────────────────────────── */

$("btn-load-nfts").addEventListener("click", loadNFTs);

async function loadNFTs() {
  if (!currentWallet) return;
  $("btn-load-nfts").textContent = "Loading…";
  try {
    const res = await fetch(`/api/nft/${currentWallet.address}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    renderNFTs(data.nfts);
  } catch (err) {
    $("nft-list").innerHTML = `<p style="color:#ef4444">Error: ${err.message}</p>`;
  } finally {
    $("btn-load-nfts").textContent = "Refresh NFTs";
  }
}

function renderNFTs(nfts) {
  const list = $("nft-list");
  if (!nfts.length) {
    list.innerHTML = "<p style='color:#94a3b8'>No music NFTs found.</p>";
    return;
  }

  list.innerHTML = nfts.map(nft => {
    const meta = nft.metadata;
    const trackName  = meta?.track?.name  ?? "Unknown Track";
    const trackStyle = meta?.track?.style ?? "";
    const trackTempo = meta?.track?.tempo ?? "";
    return `
      <div class="nft-card">
        <h4>🎵 ${escHtml(trackName)}</h4>
        ${trackStyle ? `<p>Style: ${escHtml(trackStyle)} · ${trackTempo} BPM</p>` : ""}
        <p>Token ID: <code>${escHtml(nft.nftTokenId)}</code></p>
        <p>
          <a href="https://testnet.xrpl.org/nft/${encodeURIComponent(nft.nftTokenId)}"
             target="_blank" rel="noopener" style="color:#a855f7">
            View on Explorer ↗
          </a>
        </p>
      </div>`;
  }).join("");
}

/* ── Utilities ───────────────────────────────────────────────────────────── */

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
