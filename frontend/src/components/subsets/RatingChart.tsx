import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Slider } from "../ui/slider";
import { SimpleSlider } from "./SimpleSlider";

export type RatingValue = {
  min: number;
  max: number;
  mean: number | null;
  sigma: number | null;
};

type RatingChartProps = {
  value: RatingValue;
  onChange: (v: RatingValue) => void;
  disabled?: boolean;
};

const HARD_MIN = 600;
const HARD_MAX = 2800;
const MIN_SIGMA = 50;
const MAX_SIGMA = 600;
const CHART_BLUE = "hsl(var(--chart-1))";

function gaussianPoints(
  min: number,
  max: number,
  mean: number | null,
  sigma: number | null,
): { rating: number; weight: number }[] {
  const step = Math.max(10, Math.round((max - min) / 80));
  const pts: { rating: number; weight: number }[] = [];
  for (let r = min; r <= max; r += step) {
    let weight = 1.0;
    if (mean !== null && sigma !== null && sigma > 0) {
      weight = Math.exp(-0.5 * Math.pow((r - mean) / sigma, 2));
    }
    pts.push({ rating: r, weight });
  }
  return pts;
}

export function RatingChart({
  value,
  onChange,
  disabled = false,
}: RatingChartProps): React.ReactElement {
  const displaySigma = value.sigma ?? MAX_SIGMA;
  const isUniform = displaySigma >= MAX_SIGMA;
  const effectiveMean = value.mean ?? Math.round((value.min + value.max) / 2);

  const data = gaussianPoints(
    value.min,
    value.max,
    isUniform ? null : effectiveMean,
    isUniform ? null : displaySigma,
  );

  const handleRangeChange = (vals: number[]): void => {
    const newMin = vals[0] ?? value.min;
    const newMax = vals[1] ?? value.max;
    const clampedMean =
      value.mean !== null
        ? Math.min(Math.max(value.mean, newMin), newMax)
        : null;
    onChange({ ...value, min: newMin, max: newMax, mean: clampedMean });
  };

  const handleSigmaChange = (vals: number[]): void => {
    const newSigma = vals[0] ?? MAX_SIGMA;
    if (newSigma >= MAX_SIGMA) {
      onChange({ ...value, mean: null, sigma: null });
    } else {
      onChange({
        ...value,
        mean: value.mean ?? effectiveMean,
        sigma: newSigma,
      });
    }
  };

  return (
    <div className="rounded-md border p-4">
      <div className="mb-4">
        <p className="text-sm font-semibold">Range & Distribution</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Puzzles are sampled within the range, weighted towards the mean and concentrated around said mean according to σ.
        </p>
      </div>
      <div className="relative">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="ratingConfigGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="rating"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide domain={[0, 1.05]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const entry = payload[0];
                  const weight = entry?.value;
                  const rating = (
                    entry?.payload as { rating: number } | undefined
                  )?.rating;
                  return (
                    <div className="rounded border bg-background px-2 py-1 text-xs shadow">
                      <p className="text-muted-foreground">Rating {rating}</p>
                      <p>
                        Weight{" "}
                        {typeof weight === "number" ? weight.toFixed(3) : weight}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="weight"
                stroke={CHART_BLUE}
                fill="url(#ratingConfigGradient)"
                fillOpacity={1}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          {isUniform && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-xs">
                Uniform distribution
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Rating range</span>
            <span>
              {value.min} – {value.max}
            </span>
          </div>
          <Slider
            min={HARD_MIN}
            max={HARD_MAX}
            step={25}
            value={[value.min, value.max]}
            onValueChange={handleRangeChange}
            disabled={disabled}
          />
        </div>
        {!isUniform && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mean (μ)</span>
              <span>{effectiveMean}</span>
            </div>
            <SimpleSlider
              min={value.min}
              max={value.max}
              step={25}
              value={[effectiveMean]}
              onValueChange={(vals) => {
                const v = vals[0];
                if (v !== undefined) onChange({ ...value, mean: v });
              }}
              disabled={disabled}
            />
          </div>
        )}
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Standard deviation (σ)</span>
            <span>{isUniform ? "Uniform" : displaySigma}</span>
          </div>
          <SimpleSlider
            min={MIN_SIGMA}
            max={MAX_SIGMA}
            step={25}
            value={[displaySigma]}
            onValueChange={handleSigmaChange}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
