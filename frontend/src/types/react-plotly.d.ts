declare module "react-plotly.js" {
  import { ComponentType } from "react";

  export interface PlotlyHTMLElement extends HTMLElement {
    on(event: string, callback: (data: unknown) => void): void;
    off(event: string, callback: (data: unknown) => void): void;
    purge(): void;
  }

  export interface PlotlyDataPoint {
    curveNumber?: number;
    pointNumber?: number;
    x?: number | string;
    y?: number | string;
    z?: number | string;
    data?: unknown;
    fullData?: unknown;
    fullLayout?: unknown;
  }

  export interface PlotlyEvent {
    event?: MouseEvent;
    points?: PlotlyDataPoint[];
    [key: string]: unknown;
  }

  export interface PlotlyPlotProps {
    data?: unknown[];
    layout?: unknown;
    config?: unknown;
    frames?: unknown[];
    useResizeHandler?: boolean;
    divId?: string;
    onInitialized?: (plot: PlotlyHTMLElement) => void;
    onUpdate?: (plot: PlotlyHTMLElement) => void;
    onPurge?: (plot: PlotlyHTMLElement) => void;
    onNewData?: (plot: PlotlyHTMLElement) => void;
    onError?: (error: Error) => void;
    onSelectionsChanged?: (data: PlotlyEvent[]) => void;
    onClickAnnotation?: (data: PlotlyEvent) => void;
    onClick?: (data: PlotlyEvent) => void;
    onDoubleClick?: (data: PlotlyEvent) => void;
    onAfterPlot?: (data: PlotlyEvent) => void;
    onBeforeExport?: (data: PlotlyEvent) => void;
    onBeforeHover?: (data: PlotlyEvent) => void;
    onHover?: (data: PlotlyEvent) => void;
    onUnhover?: (data: PlotlyEvent) => void;
    onSelected?: (data: PlotlyEvent) => void;
    onDeselect?: (data: PlotlyEvent) => void;
    onLegendClick?: (data: PlotlyEvent) => void;
    onLegendDoubleClick?: (data: PlotlyEvent) => void;
    onSunburstClick?: (data: PlotlyEvent) => void;
    onTreemapClick?: (data: PlotlyEvent) => void;
    [key: string]: unknown;
  }

import { ComponentType } from "react";

export interface PlotlyPlotProps {
  data?: unknown[];
  layout?: unknown;
  config?: unknown;
  frames?: unknown[];
  useResizeHandler?: boolean;
  divId?: string;
  onInitialized?: (plot: PlotlyHTMLElement) => void;
  onUpdate?: (plot: PlotlyHTMLElement) => void;
  onPurge?: (plot: PlotlyHTMLElement) => void;
  onNewData?: (plot: PlotlyHTMLElement) => void;
  onError?: (error: Error) => void;
  onSelectionsChanged?: (data: PlotlyEvent[]) => void;
  onClickAnnotation?: (data: PlotlyEvent) => void;
  onClick?: (data: PlotlyEvent) => void;
  onDoubleClick?: (data: PlotlyEvent) => void;
  onAfterPlot?: (data: PlotlyEvent) => void;
  onBeforeExport?: (data: PlotlyEvent) => void;
  onBeforeHover?: (data: PlotlyEvent) => void;
  onHover?: (data: PlotlyEvent) => void;
  onUnhover?: (data: PlotlyEvent) => void;
  onSelected?: (data: PlotlyEvent) => void;
  onDeselect?: (data: PlotlyEvent) => void;
  onLegendClick?: (data: PlotlyEvent) => void;
  onLegendDoubleClick?: (data: PlotlyEvent) => void;
  onSunburstClick?: (data: PlotlyEvent) => void;
  onTreemapClick?: (data: PlotlyEvent) => void;
  [key: string]: unknown;
}

const Plot: ComponentType<PlotlyPlotProps>;
export default Plot;
export { Plot };
}
