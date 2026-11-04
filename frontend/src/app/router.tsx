import { createBrowserRouter } from "react-router-dom";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { RegionalComparisonPage } from "@/features/regionalComparison/RegionalComparisonPage";
import { TrendsPage } from "@/features/trends/TrendsPage";
import { DataQualityPage } from "@/features/dataQuality/DataQualityPage";
import { PcaPage } from "@/features/dimensionalityReduction/PcaPage";
import { ClustersPage } from "@/features/clustering/ClustersPage";
import { AnomaliesPage } from "@/features/anomalies/AnomaliesPage";
import { AssociationRulesPage } from "@/features/associationRules/AssociationRulesPage";
import { MethodologyPage } from "@/features/methodology/MethodologyPage";
import Layout from "@/components/layout/Layout";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: OverviewPage },
      { path: "overview", Component: OverviewPage },
      { path: "regional-comparison", Component: RegionalComparisonPage },
      { path: "trends", Component: TrendsPage },
      { path: "data-quality", Component: DataQualityPage },
      { path: "pca", Component: PcaPage },
      { path: "clusters", Component: ClustersPage },
      { path: "anomalies", Component: AnomaliesPage },
      { path: "association-rules", Component: AssociationRulesPage },
      { path: "methodology", Component: MethodologyPage },
    ],
  },
]);
