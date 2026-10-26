import { createBrowserRouter } from "react-router-dom";
import Layout from "./Layout";
import ArticlePage from "../pages/ArticlePage";
import HomePageWrapper from "../components/HomePageWrapper";
import PrivacyPage from "../pages/PrivacyPage";

export const routes = [
    {
        path: "/",
        element: <Layout />,
        children: [
            {path: "", element: <HomePageWrapper />},
            { path: "artigo/:artigoId", element: <ArticlePage /> },
            { path: "privacidade", element: <PrivacyPage /> },
        ]
    }
]

const router = createBrowserRouter(routes)

export default router;