import React, {createContext, ReactNode, useContext, useEffect, useState} from 'react';
import {wsScire} from "../utils/api.ts";
import Cookies from "js-cookie";
import {setAppError} from "../slices/appSlice.ts";
import { useDispatch } from 'react-redux';

type WebSocketContextType = {
    socket: WebSocket | null;
};

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};

interface Props {
    children: ReactNode;
}

export const WebSocketProvider: React.FC<Props> = ({ children }: Props) => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const dispatch = useDispatch();

    useEffect(() => {
        const token = Cookies.get('token');
        const ws = new WebSocket(wsScire, ["token", token || '']);

        ws.onmessage = (event) => {
            console.log('Received message:', event.data);
        };

        ws.onopen = () => {
            console.log('WebSocket connected');
            dispatch(setAppError('WebSocket connected'));
        };

        ws.onerror = (error) => {
            console.error('WebSocket error', error);
            dispatch(setAppError('WebSocket error'));
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            dispatch(setAppError('WebSocket disconnected'));
        };

        setSocket(ws);

        return () => {
            ws.close();
        };
    }, []);

    // const sendMessage = (message: string) => {
    //     if (socket && socket.readyState === WebSocket.OPEN) {
    //         socket.send(message);
    //     } else {
    //         console.log('WebSocket is not open');
    //     }
    // };

    return (
        <WebSocketContext.Provider value={{ socket }}>
            {children}
        </WebSocketContext.Provider>
    );
};
