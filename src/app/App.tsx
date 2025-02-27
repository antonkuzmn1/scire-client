import useDevice from "../hooks/useDevice.ts";
import {useSelector} from "react-redux";
import {RootState} from "../utils/store.ts";
import {useAccount} from "../hooks/useAccount.ts";
import NotSupported from "./components/NotSupported.tsx";
import {DeviceSize} from "../slices/deviceSlice.ts";
import Authorization from "./components/Authorization.tsx";
import ErrorMessage from "./components/ErrorMessage.tsx";
import Message from "./components/Message.tsx";
import Loading from "./components/Loading.tsx";
import {ReactNode} from "react";
import {createBrowserRouter, Navigate, RouterProvider} from "react-router-dom";
import Page from "./pages/Page.tsx";
import PageMessenger from "./pages/PageMessenger.tsx";
import { WebSocketProvider } from "./WebSocketContext.tsx";

export interface RoutePageInterface {
    path: string;
    element: ReactNode;
    title: string;
}

export const routePages: RoutePageInterface[] = [
    {path: '/messenger', element: <Page element={<PageMessenger/>}/>, title: "Messenger"},
    {path: '/messenger/:ticketId', element: <Page element={<PageMessenger/>}/>, title: "Messenger"},
];

const router = createBrowserRouter([
    {path: "*", element: <Navigate to="/messenger"/>},
    ...routePages.map(page => ({
        path: page.path,
        element: page.element
    }))
]);


function App() {
    useDevice();
    useAccount();

    const deviceSize = useSelector((state: RootState) => state.device.size);
    const authorized = useSelector((state: RootState) => state.account.authorized);

    if (deviceSize === DeviceSize.Small) {
        return <NotSupported/>;
    }

    return (
        <WebSocketProvider>
            {!authorized ? <Authorization/> : <RouterProvider router={router}/>}

            <ErrorMessage/>
            <Message/>

            <Loading/>
        </WebSocketProvider>
    )
}

export default App
