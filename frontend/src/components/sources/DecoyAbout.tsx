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

export function DecoyAbout(): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Section title="About this source">
        <p>
          Decoy positions are sampled from master and elite OTB games between
          moves 20 and 60. A position qualifies only when the engine confirms
          that at least three moves are within 50 centipawns of the best
          evaluation — meaning no single move is clearly superior.
        </p>
      </Section>

      <Section title="What counts as correct">
        <p>
          During a run, Decoys are indistinguishable from tactical positions.
          You must play any one of the engine-approved moves to score correctly.
          After solving, the overview reveals all accepted alternatives and their
          evaluations.
        </p>
      </Section>

      <Section title="Why Decoys matter">
        <p>
          Including Decoys in a subset trains your ability to assess whether a
          forcing continuation exists, rather than assuming every position
          contains one. Over time this reduces pattern-matching shortcuts and
          builds genuine positional judgment.
        </p>
      </Section>

      <Section title="Where the data comes from">
        <p>
          Positions are extracted from games in the{" "}
          <ExternalA href="https://database.nikonoel.fr/">
            Nikonoel elite database
          </ExternalA>{" "}
          and analysed with the Stockfish engine at high depth. Only positions
          where at least three candidate moves pass the centipawn threshold are
          published to the{" "}
          <ExternalA href="https://huggingface.co/datasets/woodpecker-chess/decoy-positions">
            HuggingFace dataset
          </ExternalA>
          .
        </p>
      </Section>
    </div>
  );
}
