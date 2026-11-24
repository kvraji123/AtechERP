import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles/index.css";
import { clearLegacyPurchaseDemoData } from "./pages/modules/purchase/purchaseFrontendState";
import { UnsavedChangesProvider } from "./components/UnsavedChanges";
import { DateValidationBoundary } from "./components/DateInput";
import NumericInputBehavior from "./components/NumericInputBehavior";
import ExcelTableHeaderFilters from "./components/ExcelTableHeaderFilters";

clearLegacyPurchaseDemoData();

const router = createBrowserRouter([{ path: "*", element: <AuthProvider><DateValidationBoundary><UnsavedChangesProvider><App /></UnsavedChangesProvider></DateValidationBoundary></AuthProvider> }]);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NumericInputBehavior />
    <ExcelTableHeaderFilters />
    <RouterProvider router={router} />
  </React.StrictMode>
);
