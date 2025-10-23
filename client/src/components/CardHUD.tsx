interface CardHUDProps {
  deckName: string;
  front: string;
  transcript?: string;
  rationale?: string;
  ease?: number;
}

export function CardHUD({ deckName, front, transcript, rationale, ease }: CardHUDProps) {
  return (
    <section className="card-hud">
      <header>
        <h2>{deckName}</h2>
        <p className="prompt" dangerouslySetInnerHTML={{ __html: front }} />
      </header>
      <dl>
        <div>
          <dt>Transcript</dt>
          <dd>{transcript ?? 'Waiting for response…'}</dd>
        </div>
        <div>
          <dt>Ease</dt>
          <dd>{ease ?? '—'}</dd>
        </div>
        <div>
          <dt>Rationale</dt>
          <dd>{rationale ?? '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
