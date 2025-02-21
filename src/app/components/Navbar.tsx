import {Link, useLocation} from "react-router-dom";
import {
    AccountCircle,
    Folder,
    Settings
} from "@mui/icons-material";
import {useSelector} from "react-redux";
import {RootState} from "../../utils/store.ts";

const Navbar = () => {
    const location = useLocation();

    const deviceSize = useSelector((state: RootState) => state.device.size);

    const getLinkClass = (path: string) =>
        location.pathname === path
            ? "bg-gray-300 text-black p-4 w-full text-center"
            : "hover:bg-gray-300 text-black p-4 transition-colors duration-200 w-full text-center";

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 text-black">
            <div className="flex">
                <Link to="/files" className={getLinkClass("/files")}>
                    <div className="flex items-center justify-center space-x-2">
                        <Folder sx={{color: 'black'}}/>
                        {deviceSize === 'Large' && <span>Files</span>}
                    </div>
                </Link>
                <Link to="/config" className={getLinkClass("/config")}>
                    <div className="flex items-center justify-center space-x-2">
                        <Settings sx={{color: 'black'}}/>
                        {deviceSize === 'Large' && <span>Config</span>}
                    </div>
                </Link>
                <Link to="/me" className={getLinkClass("/me")}>
                    <div className="flex items-center justify-center space-x-2">
                        <AccountCircle sx={{color: 'black'}}/>
                        {deviceSize === 'Large' && <span>Me</span>}
                    </div>
                </Link>
            </div>
        </nav>
    );
};

export default Navbar;
