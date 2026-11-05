import Link from "next/link";
import {
  ScanEye,
  ArrowUpRight,
  ScanText,
  AudioLines,
  ShieldCheck,
} from "lucide-react";
export default function Home() {
  return (
    <main className="landing">
      <nav>
        <Link className="brand" href="/">
          <ScanEye /> SenseAI<span className="badge">VISION INTELLIGENCE</span>
        </Link>
        <Link className="button small" href="/studio">
          Open studio <ArrowUpRight size={16} />
        </Link>
      </nav>
      <section className="hero">
        <div className="eyebrow">
          <span className="dot" /> A NEW PERSPECTIVE, IN REAL TIME
        </div>
        <h1>
          See more.
          <br />
          <span>Understand more.</span>
        </h1>
        <p>
          Your surroundings, translated into understanding. Explore live object
          detection, read the world around you, and ask questions with your
          voice.
        </p>
        <Link className="button primary" href="/studio">
          Launch SenseAI <ArrowUpRight size={20} />
        </Link>
        <div className="privacy">
          <ShieldCheck size={16} /> Detection and OCR run in your browser.
        </div>
      </section>
      <div className="feature-grid">
        {[
          [
            ScanEye,
            "Live vision",
            "Identify objects and their positions with a real-time detection model.",
          ],
          [
            ScanText,
            "Read your world",
            "Capture visible text, copy it, or hear it spoken aloud.",
          ],
          [
            AudioLines,
            "A natural conversation",
            "Ask about detected objects with your voice or keyboard.",
          ],
        ].map(([Icon, title, description]) => {
          const I = Icon as typeof ScanEye;
          return (
            <article key={String(title)}>
              <I />
              <h2>{String(title)}</h2>
              <p>{String(description)}</p>
            </article>
          );
        })}
      </div>
      <footer>
        Built for curiosity. Designed for everyone.
        <span>SenseAI is not a navigation or mobility safety system.</span>
      </footer>
    </main>
  );
}
