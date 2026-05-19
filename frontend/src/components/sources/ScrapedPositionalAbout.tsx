import * as React from "react";
import { ExternalLink } from "lucide-react";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function ExternalA({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-2 hover:no-underline"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export function ScrapedPositionalAbout(): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <Section title="About this source">
        <p>
          This source contains positional puzzles mined from the Lichess games
          database and curated such that solving requires positional
          understanding, not tactical calculation. Each puzzle has a single
          constructive answer verified by titled reviewers.
        </p>
      </Section>

      <Section title="What counts as correct">
        <p>
          Solving a puzzle from this source means finding the single correct
          move. Any other move counts as a failure. There is however only
          single-move variations, meaning no follow up is required.
        </p>
      </Section>

      <Section title="Where the data comes from">
        <p>
          Positions were extracted by analysing Lichess games for moments where
          there was a best single move providing a clear advantage over
          alternatives. Each candidate position was then reviewed by titled
          players to confirm it was a positional move.
        </p>
      </Section>

      <Section title="How difficulty works">
        <p>
          Each puzzle is assigned one of four difficulty tiers based on the
          approximate Elo range of players expected to find the correct move:
          Easy (1200–1500), Medium (1500–1800), Hard (1800–2000), and Very Hard
          (2000+). Difficulty was assigned by the reviewers during the curation
          process.
        </p>
      </Section>

      <Section title="Credit and licence">
        <p>
          This dataset was compiled by{" "}
          <ExternalA href="https://github.com/neilgd"> @neilgd</ExternalA> and
          reviewed by WIM/FM Liwia Jarocka, WGM Michalina Rudzińska, and WGM
          Margarita Voyska. It is published at{" "}
          <ExternalA href="https://github.com/neilgd/chess-position-analysis-results">
            github.com/neilgd/chess-position-analysis-results
          </ExternalA>{" "}
          under a{" "}
          <ExternalA href="https://github.com/neilgd/chess-position-analysis-results/blob/main/LICENSE">
            permissive licence.
          </ExternalA>
        </p>
      </Section>
    </div>
  );
}
