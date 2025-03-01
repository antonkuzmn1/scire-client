import React, {ChangeEvent, useCallback, useEffect, useReducer, useRef, useState} from "react";
import Input from "../components/Input.tsx";
import {AppDispatch} from "../../utils/store.ts";
import {useDispatch} from "react-redux";
import {setAppError} from "../../slices/appSlice.ts";
import {apiOauth, apiScire, apiStorage} from "../../utils/api.ts";
import {formatFileSize} from "../../utils/formatFileSize.ts";
import {useNavigate, useParams} from "react-router-dom";
import {Admin, Message, Ticket, TicketFile, User} from "../../utils/interfaces.ts";
import {adminIdToName, statusToText, userIdToName} from "../../utils/messengerTools.ts";
import LoadingSpinner from "../components/LoadingSpinner.tsx";
import {useWebSocket} from "../WebSocketContext.tsx";
import {Close, Download, Menu, Send} from "@mui/icons-material";
import {dateToString} from "../../utils/formatDate.ts";
import {useTranslation} from "react-i18next";

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
    const {t} = useTranslation();

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
                    userName: userIdToName(message.user_id, usersResponse.data),
                    adminName: adminIdToName(message.admin_id, adminsResponse.data),
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
            return;
        }

        setInitDone(false);

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

        setInitDone(true);
    }, [dispatch, state.currentTicket]);

    const getUserById = (userId: number | undefined) => {
        return state.users.find(user => user.id === userId);
    }

    const getAdminById = (adminId: number | undefined) => {
        return state.admins.find(admin => admin.id === adminId);
    }

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const newFile = e.target.files[0];

        localDispatch({
            type: 'ADD_FILE',
            payload: newFile,
        });

        e.target.value = '';
    };

    const handleKeyDown = (event: any) => {
        if (event.key === "Enter") {
            if (event.shiftKey) {
                event.preventDefault();
                localDispatch({type: 'SET_MESSAGE', payload: state.message + '\n'});
            } else {
                event.preventDefault();
                sendMessage();
            }
        }
    };

    const sendMessage = () => {
        if (state.currentTicket.status === 2) {
            reopenTicket();
        }

        localDispatch({type: 'SET_MESSAGE', payload: ''});
        const text = state.message.trim();
        if (!text) {
            dispatch(setAppError('Message text required'));
            return;
        }

        setChatInitDone(false);

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

        setChatInitDone(true);
    }

    const closeTicket = () => {
        setChatInitDone(false);

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

        setChatInitDone(true);
    }

    const reopenTicket = () => {
        setChatInitDone(false);

        const payload = {
            action: 'reopen_ticket',
            data: {
                item_id: ticketId,
            }
        }
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
        } else {
            dispatch(setAppError("WebSocket error"));
        }

        setChatInitDone(true);
    }

    const downloadTicketFile = async (ticketFile: TicketFile) => {
        setChatInitDone(false);
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
            setChatInitDone(true);
        }
    }

    useEffect(() => {
        if (socket) {
            socket.onmessage = (event: any) => {
                const message = JSON.parse(event.data);
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
                        navigate(`/${message.data.id}`);
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
                    case "reopen_ticket":
                        message.data.statusText = statusToText(message.data.status);
                        message.data.userName = userIdToName(message.data.user_id, state.users);
                        message.data.adminName = adminIdToName(message.data.admin_id, state.admins);
                        localDispatch({type: "UPDATE_TICKET", payload: message.data})
                        localDispatch({type: "SET_CURRENT_TICKET", payload: message.data});
                        break;
                    case "connect_ticket":
                        message.data.statusText = statusToText(message.data.status);
                        message.data.userName = userIdToName(message.data.user_id, state.users);
                        message.data.adminName = adminIdToName(message.data.admin_id, state.admins);
                        localDispatch({type: "SET_CURRENT_TICKET", payload: message.data});
                        break;
                    case "disconnect_ticket":
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
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [state.messages]);

    if (!initDone) return <LoadingSpinner/>;

    return (
        <div
            className={`flex w-full justify-center`}
        >
            <button
                className={'border border-gray-300 fixed top-4 left-4 w-12 h-12 bg-white cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                children={<Menu/>}
                onClick={() => setTicketsPanelIsOpen(true)}
            />
            {ticketsPanelIsOpen && (
                <div
                    className={'bg-white border-r border-gray-300 fixed z-10 top-0 left-0 max-w-68 min-w-68 gap-2 flex flex-col h-dvh overflow-y-scroll p-4'}
                >
                    <div className={'sticky top-0 left-0 space-y-2'}>
                        <div className={'space-x-2 flex'}>
                            <button
                                className={'bg-white border border-gray-300 min-w-12 h-12 cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                                children={<Close/>}
                                onClick={() => setTicketsPanelIsOpen(false)}
                            />
                            <button
                                className={'bg-white border border-gray-300 w-full h-12 cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                                onClick={() => {
                                    navigate(`/me`);
                                }}
                            >
                                {t('page_messenger_left_account')}
                            </button>
                        </div>
                        <div>
                            <button
                                className={'bg-white border border-gray-300 w-full p-4 h-fit cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                                onClick={() => {
                                    navigate(`/`);
                                    setTicketsPanelIsOpen(false);
                                    localDispatch({
                                        type: 'SET_CURRENT_TICKET',
                                        payload: defaultTicket,
                                    })
                                }}
                            >
                                {t('page_messenger_left_create')}
                            </button>
                        </div>
                    </div>
                    {state.tickets.map((ticket: Ticket, index) => (
                        <div
                            key={index}
                            className={`border border-gray-300 p-4 h-fit cursor-pointer hover:bg-gray-300 transition-colors duration-200 ${ticket.status === 0 ? 'bg-red-200' : ticket.status === 1 ? 'bg-yellow-200' : 'bg-green-200'}`}
                            onClick={() => {
                                navigate(`/${ticket.id}`);
                                setTicketsPanelIsOpen(false);
                            }}
                        >
                            <h1>{ticket.title} ({t(ticket.statusText)})</h1>
                        </div>
                    ))}
                </div>
            )}
            {ticketId ? (
                chatInitDone ? (
                    <div
                        ref={containerRef}
                        className={'max-w-xl w-full gap-2 flex flex-col pt-20 pb-2 hide-scrollbar overflow-y-auto max-h-[calc(100dvh-144px)]'}
                    >
                        <div className={'border border-gray-300 p-4'}>
                            <h1 className={'font-bold text-xl'}>{state.currentTicket?.title}</h1>
                            <p className={'whitespace-pre-line'}>{state.currentTicket?.description}</p>
                            <br/>
                            <p
                                className={`w-fit + ${state.currentTicket?.status === 2
                                    ? 'bg-green-200'
                                    : state.currentTicket?.status === 1
                                        ? 'bg-yellow-200'
                                        : 'bg-red-200'}
                                `}
                            >
                                {t('page_messenger_current_field_status')}: {t(state.currentTicket?.statusText)}
                            </p>
                            {state.currentTicket?.status === 2
                                ? <button
                                    className={'border border-gray-300 p-2 cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                                    onClick={reopenTicket}
                                >
                                    {t('page_messenger_current_button_reopen_ticket')}
                                </button>
                                : <button
                                    className={'border border-gray-300 p-2 cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                                    onClick={closeTicket}
                                >
                                    {t('page_messenger_current_button_close_ticket')}
                                </button>
                            }
                            <br/>
                            <br/>
                            <p>{t('page_messenger_current_field_user')}:</p>
                            <p>
                                {t('page_messenger_current_field_user_fullname')}
                                : {state.currentTicket?.userName || t('page_messenger_current_field_placeholder')}
                            </p>
                            <p>
                                {t('page_messenger_current_field_user_department')}
                                : {getUserById(state.currentTicket?.user_id)?.department || t('page_messenger_current_field_placeholder')}
                            </p>
                            <p>
                                {t('page_messenger_current_field_user_post')}
                                : {getUserById(state.currentTicket?.user_id)?.post || t('page_messenger_current_field_placeholder')}
                            </p>
                            <p>
                                {t('page_messenger_current_field_user_local_workplace')}
                                : {getUserById(state.currentTicket?.user_id)?.local_workplace || t('page_messenger_current_field_placeholder')}
                            </p>
                            <p>
                                {t('page_messenger_current_field_user_remote_workplace')}
                                : {getUserById(state.currentTicket?.user_id)?.remote_workplace || t('page_messenger_current_field_placeholder')}
                            </p>
                            <p>
                                {t('page_messenger_current_field_user_phone')}
                                : {getUserById(state.currentTicket?.user_id)?.phone || t('page_messenger_current_field_placeholder')}
                            </p>
                            <p>
                                {t('page_messenger_current_field_user_cellular')}
                                : {getUserById(state.currentTicket?.user_id)?.cellular || t('page_messenger_current_field_placeholder')}
                            </p>
                            <br/>
                            <p className={'w-fit bg-yellow-200'}>{t('page_messenger_current_field_admin')}:</p>
                            {state.currentTicket?.admin_id ? (<>
                                <p>
                                    {t('page_messenger_current_field_admin_fullname')}
                                    : {state.currentTicket?.adminName || t('page_messenger_current_field_placeholder')}
                                </p>
                                <p>
                                    {t('page_messenger_current_field_admin_department')}
                                    : {getAdminById(state.currentTicket?.admin_id)?.department || t('page_messenger_current_field_placeholder')}
                                </p>
                                <p>
                                    {t('page_messenger_current_field_admin_post')}
                                    : {getAdminById(state.currentTicket?.admin_id)?.post || t('page_messenger_current_field_placeholder')}
                                </p>
                                <p>
                                    {t('page_messenger_current_field_admin_phone')}
                                    : {getAdminById(state.currentTicket?.admin_id)?.phone || t('page_messenger_current_field_placeholder')}
                                </p>
                                <p>
                                    {t('page_messenger_current_field_admin_cellular')}
                                    : {getAdminById(state.currentTicket?.admin_id)?.cellular || t('page_messenger_current_field_placeholder')}
                                </p>
                            </>) : <p>{t('page_messenger_current_field_placeholder')}</p>}
                            <br/>
                            <p className={'text-right'}>
                                {dateToString(new Date(String(state.currentTicket.created_at)))}
                            </p>
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
                                    <div key={index} className={'border border-gray-300 p-4 bg-yellow-200'}>
                                        <div className={'whitespace-pre-line'}>
                                            [{t('page_messenger_current_message_prefix_admin')}
                                            ] {message.adminName} {t('page_messenger_current_message_set_status_pending')}
                                        </div>
                                        <div className={'w-full text-right'}>
                                            {dateToString(new Date(String(message.created_at)))}
                                        </div>
                                    </div>
                                )
                            }
                            if (!message.admin_id &&
                                message.text === '' &&
                                !message.admin_connected &&
                                !message.admin_disconnected &&
                                !message.in_progress &&
                                !message.solved
                            ) {
                                return (
                                    <div key={index} className={'border border-gray-300 p-4'}>
                                        <div className={'whitespace-pre-line'}>
                                            {message.userName} {t('page_messenger_current_message_set_status_pending')}
                                        </div>
                                        <div className={'w-full text-right'}>
                                            {dateToString(new Date(String(message.created_at)))}
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
                                    <div key={index} className={'border border-gray-300 p-4 bg-yellow-200'}>
                                        <div className={'whitespace-pre-line'}>
                                            [{t('page_messenger_current_message_prefix_admin')}
                                            ] {message.adminName} {t('page_messenger_current_message_set_status_in_progress')}
                                        </div>
                                        <div className={'w-full text-right'}>
                                            {dateToString(new Date(String(message.created_at)))}
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
                                    <div key={index} className={'border border-gray-300 p-4 bg-yellow-200'}>
                                        <div className={'whitespace-pre-line'}>
                                            [{t('page_messenger_current_message_prefix_admin')}
                                            ] {message.adminName} {t('page_messenger_current_message_set_status_solved')}
                                        </div>
                                        <div className={'w-full text-right'}>
                                            {dateToString(new Date(String(message.created_at)))}
                                        </div>
                                    </div>
                                )
                            }
                            if (message.admin_connected) {
                                return (
                                    <div key={index} className={'border border-gray-300 p-4 bg-yellow-200'}>
                                        <div className={'whitespace-pre-line'}>
                                            [{t('page_messenger_current_message_prefix_admin')}
                                            ] {message.adminName} {t('page_messenger_current_message_connected')}
                                        </div>
                                        <div className={'w-full text-right'}>
                                            {dateToString(new Date(String(message.created_at)))}
                                        </div>
                                    </div>
                                )
                            }
                            if (message.admin_disconnected) {
                                return (
                                    <div key={index} className={'border border-gray-300 p-4 bg-yellow-200'}>
                                        <div className={'whitespace-pre-line'}>
                                            [{t('page_messenger_current_message_prefix_admin')}
                                            ] {message.adminName} {t('page_messenger_current_message_disconnected')}
                                        </div>
                                        <div className={'w-full text-right'}>
                                            {dateToString(new Date(String(message.created_at)))}
                                        </div>
                                    </div>
                                )
                            }
                            if (message.solved && !message.admin_id) {
                                return (
                                    <div key={index} className={'border border-gray-300 p-4'}>
                                        <div className={'whitespace-pre-line'}>
                                            {message.userName} {t('page_messenger_current_message_set_status_solved')}
                                        </div>
                                        <div className={'w-full text-right'}>
                                            {dateToString(new Date(String(message.created_at)))}
                                        </div>
                                    </div>
                                )
                            }
                            if (message.admin_id) {
                                return (
                                    <div key={index} className={'border border-gray-300 p-4 bg-yellow-200'}>
                                        <div>
                                            [{t('page_messenger_current_message_prefix_admin')}
                                            ] {message.adminName}:
                                        </div>
                                        <div className={'whitespace-pre-line'}>
                                            {message.text}
                                        </div>
                                        <div className={'w-full text-right'}>
                                            {dateToString(new Date(String(message.created_at)))}
                                        </div>
                                    </div>
                                )
                            }
                            return (
                                <div key={index} className={'border border-gray-300 p-4'}>
                                    <div>
                                        {message.userName}:
                                    </div>
                                    <div className={'whitespace-pre-line'}>
                                        {message.text}
                                    </div>
                                    <div className={'w-full text-right'}>
                                        {dateToString(new Date(String(message.created_at)))}
                                    </div>
                                </div>
                            )
                        })}
                        <div className={'max-w-xl w-full h-36 border border-gray-300 flex fixed bottom-0 bg-white'}>
                        <textarea
                            className={'w-full h-full resize-none p-4'}
                            placeholder={t('page_messenger_current_input_placeholder')}
                            value={state.message}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => localDispatch({
                                type: 'SET_MESSAGE',
                                payload: e.target.value,
                            })}
                            onKeyDown={handleKeyDown}
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
                        label={t('page_messenger_new_field_title_label')}
                        placeholder={t('page_messenger_new_field_title_placeholder')}
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
                            {t('page_messenger_new_field_description_title')}
                        </label>
                        <textarea
                            placeholder={t('page_messenger_new_field_description_placeholder')}
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
                            className={'border-r border-gray-300 min-w-36 flex items-center justify-center text-gray-700'}
                        >
                            {t('page_messenger_new_field_files_title')}
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
                                {t('page_messenger_new_field_files_add')}
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
                                        {t('page_messenger_new_field_files_del')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button
                        className={'border border-gray-300 h-12 cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                        onClick={createTicket}
                    >
                        {t('page_messenger_new_button_create')}
                    </button>
                </div>
            )}
        </div>
    )
}

export default PageMessenger;
