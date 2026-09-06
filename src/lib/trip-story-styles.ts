/** Shared CSS for trip story HTML (TinyMCE iframe + read-only view). */
export const TRIP_STORY_CONTENT_STYLE = `
  body {
    font-family: Manrope, ui-sans-serif, system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.65;
    color: #1e293b;
    margin: 0;
    padding: 0;
  }
  .trip-story {
    max-width: 42rem;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
  }
  .story-kicker {
    margin: 0 0 0.75rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #64748b;
  }
  .trip-story h1 {
    margin: 0 0 0.5rem;
    font-family: Fraunces, Georgia, serif;
    font-size: clamp(1.875rem, 4vw, 2.5rem);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.02em;
  }
  .story-lead {
    margin: 0 0 1.75rem;
    font-size: 1.125rem;
    color: #475569;
  }
  .story-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem 2rem;
    margin: 0 0 2.5rem;
    padding: 0 0 2rem;
    border-bottom: 1px solid #e2e8f0;
  }
  .story-stat {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .story-stat-label {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #64748b;
  }
  .story-stat-value {
    font-size: 1rem;
    font-weight: 600;
    color: #0f172a;
  }
  .story-timeline {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }
  @media (min-width: 768px) {
    .story-timeline {
      grid-template-columns: 1fr 1fr;
    }
    .story-note {
      grid-column: 1 / -1;
    }
  }
  .story-photo {
    margin: 0;
  }
  .story-photo img,
  .story-photo video {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 1rem;
  }
  .story-photo figcaption {
    margin-top: 0.5rem;
    font-size: 0.8125rem;
    color: #64748b;
  }
  .story-note {
    margin: 0;
    padding: 1rem 1.25rem;
    border-left: 3px solid #cbd5e1;
    background: #f8fafc;
    border-radius: 0 0.75rem 0.75rem 0;
  }
  .story-note time {
    display: block;
    margin-bottom: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #64748b;
  }
  .story-note p {
    margin: 0;
  }
`
