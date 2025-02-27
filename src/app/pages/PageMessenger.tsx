import React, {ChangeEvent, useCallback, useEffect, useReducer, useRef, useState} from "react";
import Input from "../components/Input.tsx";
import {AppDispatch} from "../../utils/store.ts";
import {useDispatch} from "react-redux";
import {setAppError, setAppLoading} from "../../slices/appSlice.ts";
import {apiOauth, apiScire, apiStorage} from "../../utils/api.ts";
import {formatFileSize} from "../../utils/formatFileSize.ts";
import {useNavigate, useParams} from "react-router-dom";
import {Admin, Message, Ticket, TicketFile, User} from "../../utils/interfaces.ts";
import {adminIdToName, statusToText, userIdToName} from "../../utils/messengerTools.ts";
import LoadingSpinner from "../components/LoadingSpinner.tsx";
import {useWebSocket} from "../WebSocketContext.tsx";
import {Close, Download, Menu, Send} from "@mui/icons-material";
import {dateToString} from "../../utils/formatDate.ts";

interface State {
    tickets: Ticket[];
    currentTicket: Ticket;
    currentTicketFiles: TicketFile[];
    messages: Message[];
    message: string;
    files: File[];

    users: User[];
    admins: Admin[];
}


type Action =
    | { type: 'SET_TICKETS', payload: Ticket[] }
    | { type: 'ADD_TICKET', payload: Ticket }
    | { type: 'UPDATE_TICKET', payload: Ticket }
    | { type: 'DELETE_TICKET', payload: Ticket }

    | { type: 'SET_CURRENT_TICKET', payload: Ticket }
    | { type: 'SET_CURRENT_TICKET_FILES', payload: TicketFile[] }

    | { type: 'UPDATE_CURRENT_TICKET', payload: Partial<Ticket> }
    | { type: 'ADD_FILE', payload: File | null }
    | { type: 'DELETE_FILE', payload: number }

    | { type: 'SET_MESSAGES', payload: Message[] }
    | { type: 'ADD_MESSAGE', payload: Message }
    | { type: 'SET_MESSAGE', payload: string }

    | { type: 'SET_ADMINS', payload: Admin[] }
    | { type: 'SET_USERS', payload: User[] };


const defaultTicket: Ticket = {
    id: 0,
    title: '',
    description: '',
    status: 0,
    statusText: 'Pending',
    user_id: 0,
    userName: '',
    admin_id: null,
    adminName: '',
    created_at: null,
    updated_at: null,
}

const initialState: State = {
    tickets: [],
    currentTicket: defaultTicket,
    currentTicketFiles: [],
    messages: [],
    message: '',
    files: [],

    admins: [],
    users: [],
}


const reducer = (state: State, action: Action): State => {
    switch (action.type) {

        case 'SET_TICKETS':
            return {...state, tickets: action.payload}
        case 'ADD_TICKET':
            return {...state, tickets: [action.payload, ...state.tickets]}
        case 'UPDATE_TICKET':
            return {
                ...state,
                tickets: state.tickets.map(ticket => ticket.id === action.payload.id ? action.payload : ticket),
            }
        case 'DELETE_TICKET':
            return {...state, tickets: state.tickets.filter(ticket => ticket.id !== action.payload.id)}

        case 'SET_CURRENT_TICKET':
            return {...state, currentTicket: action.payload}
        case 'SET_CURRENT_TICKET_FILES':
            return {...state, currentTicketFiles: action.payload}

        case 'UPDATE_CURRENT_TICKET':
            return {...state, currentTicket: {...state.currentTicket, ...action.payload}}
        case 'ADD_FILE':
            return {...state, files: action.payload ? [...state.files, action.payload] : state.files}
        case 'DELETE_FILE':
            return {...state, files: state.files.filter((_, i) => i !== action.payload)}

        case 'SET_MESSAGES':
            return {...state, messages: action.payload}
        case 'ADD_MESSAGE':
            return {...state, messages: [...state.messages, action.payload]}
        case 'SET_MESSAGE':
            return {...state, message: action.payload}

        case 'SET_ADMINS':
            return {...state, admins: action.payload}
        case 'SET_USERS':
            return {...state, users: action.payload}

        default:
            return state;
    }
}

const PageMessenger: React.FC = () => {
    const dispatch: AppDispatch = useDispatch();
    const [state, localDispatch] = useReducer(reducer, initialState);
    const navigate = useNavigate();
    const [initDone, setInitDone] = useState<boolean>(false);
    const [chatInitDone, setChatInitDone] = useState<boolean>(false);
    const {socket} = useWebSocket();
    const {ticketId} = useParams();
    const [ticketsPanelIsOpen, setTicketsPanelIsOpen] = useState<boolean>(!ticketId);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const init = useCallback(async () => {
        setInitDone(false);
        try {
            const adminsResponse = await apiOauth.get("/admins/");
            localDispatch({type: "SET_ADMINS", payload: adminsResponse.data});

            const response = await apiScire.get("/tickets/");
            const data = response.data.map((ticket: Ticket) => {
                return {
                    ...ticket,
                    statusText: statusToText(ticket.status),
                    adminName: adminIdToName(ticket.admin_id, adminsResponse.data),
                }
            })
            data.sort((a: Ticket, b: Ticket) => {
                return new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()
            });
            localDispatch({type: "SET_TICKETS", payload: data});
        } catch (error: unknown) {
            if (error instanceof Error) {
                dispatch(setAppError(error.message));
            } else {
                dispatch(setAppError("An unknown error occurred"));
            }
        } finally {
            setInitDone(true);
        }
    }, []);

    useEffect(() => {
        init().then();
    }, [dispatch, init]);

    const initChat = useCallback(async () => {
        if (!ticketId) {
            return;
        }

        setChatInitDone(false);
        console.log(state.users)
        try {
            const adminsResponse = await apiOauth.get("/admins/");
            localDispatch({type: "SET_ADMINS", payload: adminsResponse.data});

            const usersResponse = await apiOauth.get("/users/");
            localDispatch({type: "SET_USERS", payload: usersResponse.data});

            const ticketResponse = await apiScire.get(`/tickets/${ticketId}`);
            const data = ticketResponse.data;
            data.statusText = statusToText(data.status);
            data.userName = userIdToName(data.user_id, usersResponse.data);
            data.adminName = adminIdToName(data.admin_id, adminsResponse.data);
            localDispatch({type: "SET_CURRENT_TICKET", payload: data});

            const ticketFilesResponse = await apiScire.get(`/tickets/${ticketId}/files`);
            const ticketFiles = ticketFilesResponse.data;
            localDispatch({type: "SET_CURRENT_TICKET_FILES", payload: ticketFiles});

            const messagesResponse = await apiScire.get(`/messages/${ticketId}`);
            const messages: Message[] = messagesResponse.data.map((message: Message) => {
                return {
                    ...message,
                    userName: userIdToName(data.user_id, usersResponse.data),
                    adminName: adminIdToName(data.admin_id, adminsResponse.data),
                }
            });
            localDispatch({type: "SET_MESSAGES", payload: messages});
        } catch (error: unknown) {
            if (error instanceof Error) {
                dispatch(setAppError(error.message));
            } else {
                dispatch(setAppError("An unknown error occurred"));
            }
        } finally {
            setChatInitDone(true);
        }
    }, [dispatch, ticketId]);

    useEffect(() => {
        initChat().then();
    }, [ticketId]);

    const createTicket = useCallback(() => {
        const title = state.currentTicket.title.trim();
        const description = state.currentTicket.description.trim();
        if (!title || !description) {
            dispatch(setAppError('Title and Description required'));
        }

        dispatch(setAppLoading(true));

        const payload = {
            action: 'create_ticket',
            data: {
                title,
                description,
            }
        }
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
        } else {
            dispatch(setAppError("WebSocket error"));
        }

        dispatch(setAppLoading(false));
    }, [dispatch, state.currentTicket]);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const newFile = e.target.files[0];

        localDispatch({
            type: 'ADD_FILE',
            payload: newFile,
        });

        e.target.value = '';
    };

    const sendMessage = () => {
        localDispatch({type: 'SET_MESSAGE', payload: ''});
        const text = state.message.trim();
        if (!text) {
            dispatch(setAppError('Message text required'));
        }

        dispatch(setAppLoading(true));

        const payload = {
            action: 'send_message',
            data: {
                text,
                ticket_id: ticketId,
            }
        }
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
        } else {
            dispatch(setAppError("WebSocket error"));
        }

        dispatch(setAppLoading(false));
    }

    const closeTicket = () => {
        dispatch(setAppLoading(true));

        const payload = {
            action: 'close_ticket',
            data: {
                item_id: ticketId,
            }
        }
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
        } else {
            dispatch(setAppError("WebSocket error"));
        }

        dispatch(setAppLoading(false));
    }

    const downloadTicketFile = async (ticketFile: TicketFile) => {
        dispatch(setAppLoading(true));
        try {
            const response = await apiStorage.get(`/file/${ticketFile.file_uuid}`, {
                responseType: "blob",
            });

            const blob = new Blob([response.data], {type: response.headers["content-type"]});
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = ticketFile.file_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);
        } catch (error: unknown) {
            if (error instanceof Error) {
                dispatch(setAppError(error.message));
            } else {
                dispatch(setAppError("An unknown error occurred"));
            }
        } finally {
            dispatch(setAppLoading(false));
        }
    }

    useEffect(() => {
        if (socket) {
            socket.onmessage = (event: any) => {
                const message = JSON.parse(event.data);
                console.log(message);
                switch (message.action) {
                    case "create_ticket":
                        message.data.statusText = statusToText(message.data.status);
                        message.data.adminName = adminIdToName(message.data.admin_id, state.admins);
                        message.data.userName = userIdToName(message.data.user_id, state.users);
                        localDispatch({
                            type: 'ADD_TICKET',
                            payload: message.data,
                        });
                        localDispatch({
                            type: 'UPDATE_CURRENT_TICKET',
                            payload: {title: '', description: ''},
                        })
                        navigate(`/messenger/${message.data.id}`);
                        state.files.forEach(async (file: File) => {
                            const formData = new FormData();
                            formData.append("file", file);
                            try {
                                const response = await apiStorage.post("/file", formData, {
                                    headers: {
                                        "Content-Type": "multipart/form-data",
                                    },
                                });

                                const payload = {
                                    action: 'add_file_to_ticket',
                                    data: {
                                        item_id: message.data.id,
                                        file_uuid: response.data.uuid,
                                        file_name: response.data.name,
                                        file_size: response.data.size,
                                    }
                                }
                                if (socket && socket.readyState === WebSocket.OPEN) {
                                    socket.send(JSON.stringify(payload));
                                } else {
                                    dispatch(setAppError("WebSocket error"));
                                }
                            } catch (error: unknown) {
                                if (error instanceof Error) {
                                    dispatch(setAppError(error.message));
                                } else {
                                    dispatch(setAppError("An unknown error occurred"));
                                }
                            }
                        })
                        break;
                    case "add_file_to_ticket":
                        state.files.forEach((_, index) => {
                            localDispatch({
                                type: 'DELETE_FILE',
                                payload: index,
                            })
                        })
                        break;
                    case "send_message":
                        message.data.userName = userIdToName(message.data.user_id, state.users);
                        message.data.adminName = adminIdToName(message.data.admin_id, state.admins);
                        localDispatch({type: "ADD_MESSAGE", payload: message.data});
                        break;
                    case "close_ticket":
                        message.data.statusText = statusToText(message.data.status);
                        message.data.userName = userIdToName(message.data.user_id, state.users);
                        message.data.adminName = adminIdToName(message.data.admin_id, state.admins);
                        localDispatch({type: "UPDATE_TICKET", payload: message.data})
                        localDispatch({type: "SET_CURRENT_TICKET", payload: message.data});
                        break;
                    case "assign_ticket":
                        message.data.statusText = statusToText(message.data.status);
                        message.data.userName = userIdToName(message.data.user_id, state.users);
                        message.data.adminName = adminIdToName(message.data.admin_id, state.admins);
                        localDispatch({type: "SET_CURRENT_TICKET", payload: message.data});
                        break;
                    case "set_ticket_status":
                        message.data.statusText = statusToText(message.data.status);
                        message.data.userName = userIdToName(message.data.user_id, state.users);
                        message.data.adminName = adminIdToName(message.data.admin_id, state.admins);
                        localDispatch({type: "UPDATE_TICKET", payload: message.data})
                        localDispatch({type: "SET_CURRENT_TICKET", payload: message.data})
                        break;
                    default:
                        dispatch(setAppError("Unknown message type received via WebSocket"));
                        break;
                }
            };
        }
    }, [state.files, state.users, state.admins]);

    useEffect(() => {
        console.log(state.messages)
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [state.messages]);

    if (!initDone) return <LoadingSpinner/>;

    return (
        <div className={'flex w-full justify-center pt-4 pb-40'}>
            <button
                className={'border border-gray-300 fixed top-4 left-4 w-12 h-12 bg-white cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                children={<Menu/>}
                onClick={() => setTicketsPanelIsOpen(true)}
            />
            {ticketsPanelIsOpen && (
                <div
                    className={'bg-white border-r border-gray-300 fixed z-10 top-0 left-0 max-w-68 min-w-68 gap-2 flex flex-col h-dvh overflow-y-scroll p-4'}
                >
                    <div className={'sticky top-0 left-0 space-x-2 flex'}>
                        <button
                            className={'bg-white border border-gray-300 min-w-12 h-12 cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                            children={<Close/>}
                            onClick={() => setTicketsPanelIsOpen(false)}
                        />
                        <button
                            className={'bg-white border border-gray-300 w-full h-12 cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                            onClick={() => {
                                navigate(`/messenger`);
                                setTicketsPanelIsOpen(false);
                                localDispatch({
                                    type: 'SET_CURRENT_TICKET',
                                    payload: defaultTicket,
                                })
                            }}
                        >
                            <h1>Create new ticket</h1>
                        </button>
                    </div>
                    {state.tickets.map((ticket: Ticket, index) => (
                        <div
                            key={index}
                            className={`border border-gray-300 p-4 h-fit cursor-pointer hover:bg-gray-300 transition-colors duration-200 ${ticket.status === 0 ? 'bg-red-200' : ticket.status === 1 ? 'bg-yellow-200' : 'bg-green-200'}`}
                            onClick={() => {
                                navigate(`/messenger/${ticket.id}`);
                                setTicketsPanelIsOpen(false);
                            }}
                        >
                            <h1>{ticket.title} ({ticket.statusText})</h1>
                        </div>
                    ))}
                </div>
            )}
            {ticketId ? (
                chatInitDone ? (
                    <div
                        ref={containerRef}
                        className={'max-w-xl w-full gap-2 flex flex-col pb-2 overflow-y-auto max-h-[calc(100dvh-160px)]'}
                    >
                        <div className={'border border-gray-300 p-4'}>
                            <h1 className={'font-bold text-xl'}>{state.currentTicket?.title}</h1>
                            <p className={'whitespace-pre-line'}>{state.currentTicket?.description}</p>
                            <p>Status: {state.currentTicket?.statusText}</p>
                            <button
                                className={'border border-gray-300 p-2 cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                                onClick={closeTicket}
                            >
                                Close ticket
                            </button>
                            <p>Initiator: {state.currentTicket?.userName}</p>
                            <p>Assigned: {state.currentTicket?.adminName || 'None'}</p>
                            <p>Date: {state.currentTicket ? dateToString(new Date(String(state.currentTicket.created_at))) : 'Loading...'}</p>
                            {state.currentTicketFiles.length > 0 && (
                                <div className={'border border-gray-300 p-2 space-y-2'}>
                                    {state.currentTicketFiles.map((ticketFile, index) => (
                                        <div key={index}
                                             className={'border border-gray-300 flex justify-between items-center pl-2 h-12'}>
                                            {ticketFile.file_name} - {formatFileSize(ticketFile.file_size)}
                                            <button
                                                className={'w-12 h-full cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                                                onClick={() => downloadTicketFile(ticketFile)}
                                            >
                                                <Download/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {state.messages.map((message, index) => {
                            if (message.admin_id &&
                                message.text === '' &&
                                !message.admin_connected &&
                                !message.admin_disconnected &&
                                !message.in_progress &&
                                !message.solved
                            ) {
                                return (
                                    <div key={index} className={'border border-gray-300 p-4'}>
                                        <div className={'whitespace-pre-line'}>
                                            [Admin] {message.adminName} marked ticket as Pending
                                        </div>
                                    </div>
                                )
                            }
                            if (message.admin_id &&
                                message.text === '' &&
                                !message.admin_connected &&
                                !message.admin_disconnected &&
                                message.in_progress &&
                                !message.solved
                            ) {
                                return (
                                    <div key={index} className={'border border-gray-300 p-4'}>
                                        <div className={'whitespace-pre-line'}>
                                            [Admin] {message.adminName} marked ticket as In progress
                                        </div>
                                    </div>
                                )
                            }
                            if (message.admin_id &&
                                message.text === '' &&
                                !message.admin_connected &&
                                !message.admin_disconnected &&
                                !message.in_progress &&
                                message.solved
                            ) {
                                return (
                                    <div key={index} className={'border border-gray-300 p-4'}>
                                        <div className={'whitespace-pre-line'}>
                                            [Admin] {message.adminName} marked ticket as Solved
                                        </div>
                                    </div>
                                )
                            }
                            if (message.admin_connected) {
                                return (
                                    <div key={index} className={'border border-gray-300 p-4'}>
                                        <div className={'whitespace-pre-line'}>
                                            [Admin] {message.adminName} connected
                                        </div>
                                    </div>
                                )
                            }
                            if (message.solved && !message.admin_id) {
                                return (
                                    <div key={index} className={'border border-gray-300 p-4'}>
                                        <div className={'whitespace-pre-line'}>
                                            {message.userName} marked ticket as Solved
                                        </div>
                                    </div>
                                )
                            }
                            if (message.admin_id) {
                                return (
                                    <div key={index} className={'border border-gray-300 p-4'}>
                                        <div className={'whitespace-pre-line'}>
                                            [Admin] {message.adminName}: {message.text}
                                        </div>
                                    </div>
                                )
                            }
                            return (
                                <div key={index} className={'border border-gray-300 p-4'}>
                                    <div className={'whitespace-pre-line'}>
                                        {message.userName}: {message.text}
                                    </div>
                                </div>
                            )
                        })}
                        <div className={'max-w-xl w-full h-36 border border-gray-300 flex fixed bottom-0 bg-white'}>
                        <textarea
                            className={'w-full h-full resize-none p-4'}
                            placeholder={'Enter message'}
                            value={state.message}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => localDispatch({
                                type: 'SET_MESSAGE',
                                payload: e.target.value,
                            })}
                        />
                            <button
                                className={'p-4 cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                                onClick={sendMessage}
                            >
                                <Send/>
                            </button>
                        </div>
                    </div>
                ) : (
                    <LoadingSpinner/>
                )
            ) : (
                <div className={'max-w-xl w-full gap-2 p-4 flex flex-col min-h-dvh justify-center'}>
                    <Input
                        label={'Title'}
                        placeholder={'Enter value...'}
                        type={'text'}
                        value={state.currentTicket.title || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => localDispatch({
                            type: 'UPDATE_CURRENT_TICKET',
                            payload: {title: e.target.value}
                        })}
                    />
                    <div className={'border border-gray-300 h-48 flex'}>
                        <label
                            className={'border-r border-gray-300 min-w-36 flex items-center justify-center text-gray-700'}
                        >
                            Description
                        </label>
                        <textarea
                            placeholder={'Enter value...'}
                            value={state.currentTicket.description || ''}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => localDispatch({
                                type: 'UPDATE_CURRENT_TICKET',
                                payload: {description: e.target.value},
                            })}
                            className={'p-2 w-full text-gray-700 resize-none'}
                        />
                    </div>
                    <div className={'border border-gray-300 h-fit flex'}>
                        <label
                            className={'border-r border-gray-300 min-w-36 flex items-center justify-center text-gray-700'}>
                            Files
                        </label>
                        <div className={'w-full p-2 space-y-2'}>
                            <input
                                className={'hidden'}
                                type='file'
                                id="file-upload"
                                onChange={handleFileChange}
                            />
                            <label
                                htmlFor="file-upload"
                                className="h-12 px-3 w-full border border-gray-300 flex items-center cursor-pointer text-gray-700 hover:bg-gray-300 transition-colors duration-200"
                            >
                                Add file
                            </label>
                            {state.files.map((file: File, index: number) => (
                                <div
                                    key={index}
                                    className={'h-12 w-full border border-gray-300 pl-2 flex items-center justify-between text-gray-700'}
                                >
                                    {file.name + " - " + formatFileSize(file.size)}
                                    <button
                                        className={'h-12 px-2 w-100px flex items-center cursor-pointer text-gray-700 hover:bg-gray-300 transition-colors duration-200'}
                                        onClick={() => localDispatch({
                                            type: 'DELETE_FILE',
                                            payload: index,
                                        })}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button
                        className={'border border-gray-300 h-12 cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                        onClick={createTicket}
                    >
                        Create ticket
                    </button>
                </div>
            )}

            {ticketId ? (
                chatInitDone ? (<></>) : (<></>)
            ) : (
                <></>
            )
            }
        </div>
    )
}

export default PageMessenger;
