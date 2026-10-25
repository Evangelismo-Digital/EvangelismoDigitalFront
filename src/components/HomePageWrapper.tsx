import { useLocation } from "react-router-dom";
import HomePage from "../pages/HomePage";
import { useEffect, useState } from "react";

const HomePageWrapper = () => {
    const location = useLocation();
    const [section, setSection] = useState<string | undefined>();
    
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const sectionParam = params.get("section") || undefined;
        
        // No default: a plain "/" opens at the top, where "Artigos" already is, without a scroll that could
        // land late, after the page loads, and pull back someone who already scrolled down.
        setSection(sectionParam);
    }, [location.search]);

    return <HomePage section={section} />;
}

export default HomePageWrapper;