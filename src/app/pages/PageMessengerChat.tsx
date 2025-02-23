import React, {useCallback, useEffect, useReducer, useRef} from "react";
import {AppDispatch} from "../../utils/store.ts";
import {useDispatch} from "react-redux";
import {setAppError, setAppLoading} from "../../slices/appSlice.ts";
import {apiOauth, apiScire} from "../../utils/api.ts";
import Cookies from "js-cookie";
import {useNavigate} from "react-router-dom";

interface StorageFile {
    uuid: string;
    name: string;
    size: number;
    sizeFormatted: string;
    user_id: number;
    userName: string;
    created_at: string | null;
    updated_at: string | null;
    file: File | null;
}

interface Company {
    id: number;
    username: string;
    description: string;
    created_at: string | null;
    updated_at: string | null;
}

interface User {
    id: number;
    username: string;
    password: string;
    surname: string;
    name: string;
    middlename: string | null;
    department: string | null;
    local_workplace: string | null;
    remote_workplace: string | null;
    phone: string | null;
    cellular: string | null;
    post: string | null;
    company_id: number;
    company: Company | null;
    companyName: string;
    created_at: string | null;
    updated_at: string | null;
}

interface Admin {
    id: number;
    username: string;
    password: string;
    surname: string;
    name: string;
    middlename: string | null;
    department: string | null;
    phone: string | null;
    cellular: string | null;
    post: string | null;
    companies: Company[]
    companyNames: string;
    created_at: string | null;
    updated_at: string | null;
}

interface MessageFile {
    item_id: number;
    file_uuid: string;
    file_name: string;
    file_size: number;
}

interface TicketFile {
    item_id: number;
    file_uuid: string;
    file_name: string;
    file_size: number;
}

interface Message {
    id: number;
    text: string;
    user_id: number;
    admin_id: number | null;
    ticket_id: Ticket['id'];
    admin_connected: boolean;
    admin_disconnected: boolean;
    in_progress: boolean;
    solved: boolean;
    files: MessageFile[];
}

interface Ticket {
    id: number;
    title: string;
    description: string;
    status: 0 | 1 | 2
    statusText: 'Pending' | 'In progress' | 'Solved';
    user_id: number;
    admin_id: number | null;
    adminName: string;
    created_at: string | null;
    updated_at: string | null;
}

interface State {
    ticket: Ticket;
    messages: Message[];
    admins: Admin[];
    users: User[];
    ticketFiles: TicketFile[];
    messageFiles: MessageFile[];
    files: File[];
}

type Action =
    | { type: 'SET_TICKET', payload: Ticket }
    | { type: 'SET_MESSAGES', payload: Message[] }
    | { type: 'SET_ADMINS', payload: Admin[] }
    | { type: 'SET_USERS', payload: User[] }
    | { type: 'SET_TICKET_FILES', payload: TicketFile[] }
    | { type: 'SET_MESSAGE_FILES', payload: MessageFile[] }
    | { type: 'ADD_FILE', payload: File | null }
    | { type: 'DELETE_FILE', payload: number };

const defaultTicket: Ticket = {
    id: 0,
    title: '',
    description: '',
    status: 0,
    statusText: 'Pending',
    user_id: 0,
    admin_id: null,
    adminName: '',
    created_at: null,
    updated_at: null,
}

const initialState: State = {
    tickets: [],
    dialog: null,
    currentTicket: defaultTicket,
    admins: [],
    files: [],
}

const reducer = (state: State, action: Action): State => {
    switch (action.type) {
        case 'SET_TICKET':
            return {
                ...state,
                ticket: action.payload,
            }
        case 'SET_MESSAGES':
            return {
                ...state,
                messages: action.payload,
            }
        case 'SET_ADMINS':
            return {
                ...state,
                admins: action.payload,
            }
        case 'SET_USERS':
            return {
                ...state,
                users: action.payload,
            }
        case 'SET_TICKET_FILES':
            return {
                ...state,
                ticketFiles: action.payload,
            }
        case 'SET_MESSAGE_FILES':
            return {
                ...state,
                messageFiles: action.payload,
            }
        case 'ADD_FILE':
            return {
                ...state,
                files: action.payload ? [...state.files, action.payload] : state.files,
            }
        case 'DELETE_FILE':
            return {
                ...state,
                files: state.files.filter((_, i) => i !== action.payload),
            }
        default:
            return state;
    }
}

function statusToText(status: 0 | 1 | 2) {
    return status === 2
        ? 'Solved'
        : status === 1
            ? 'In progress'
            : 'Pending';
}

function adminIdToName(adminId: number | null, admins: Admin[]) {
    const admin = admins.find((admin: Admin) => admin.id === adminId);
    if (!admin) {
        return '';
    }
    return `${admin.surname} ${admin.name} ${admin.middlename}`.trim()
}

function userIdToName(userId: number | null, users: User[]) {
    const user = users.find((user: User) => user.id === userId);
    if (!user) {
        return '';
    }
    return `${user.surname} ${user.name} ${user.middlename}`.trim()
}

const PageMessengerChat: React.FC = () => {
    const dispatch: AppDispatch = useDispatch();
    const [state, localDispatch] = useReducer(reducer, initialState);
    const wsRef = useRef<WebSocket | null>(null);
    const navigate = useNavigate();

    const getTickets = useCallback(async () => {
        dispatch(setAppLoading(true));
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
            console.log(data)
            localDispatch({type: "SET_TICKETS", payload: data});
        } catch (error: unknown) {
            if (error instanceof Error) {
                dispatch(setAppError(error.message));
            } else {
                dispatch(setAppError("An unknown error occurred"));
            }
        } finally {
            dispatch(setAppLoading(false));
        }
    }, []);

    useEffect(() => {
        getTickets().then();
    }, [dispatch]);

    // const createTicket = useCallback(() => {
    //     const title = state.currentTicket.title.trim();
    //     const description = state.currentTicket.description.trim();
    //     if (!title || !description) {
    //         dispatch(setAppError('Title and Description required'));
    //     }
    //
    //     dispatch(setAppLoading(true));
    //
    //     const payload = {
    //         action: 'create_ticket',
    //         data: {
    //             title,
    //             description,
    //         }
    //     }
    //     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
    //         wsRef.current.send(JSON.stringify(payload));
    //     } else {
    //         dispatch(setAppError("WebSocket error"));
    //     }
    //
    //     dispatch(setAppLoading(false));
    // }, [dispatch, state.currentTicket]);

    // const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    //     if (!e.target.files || e.target.files.length === 0) return;
    //
    //     const newFile = e.target.files[0];
    //
    //     localDispatch({
    //         type: 'ADD_FILE',
    //         payload: newFile,
    //     });
    //
    //     e.target.value = '';
    // };

    useEffect(() => {
        const token = Cookies.get('token');
        wsRef.current = new WebSocket('ws://localhost:8000', ["token", token || '']);

        wsRef.current.onopen = () => {
        };

        wsRef.current.onerror = (error: any) => {
            console.log('WebSocket error');
            dispatch(setAppError(error || 'WebSocket error'));
        };

        wsRef.current.onclose = () => {
            console.log('WebSocket closed');
            // dispatch(setAppMessage("WebSocket closed"));
        };

        return () => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close();
                console.log('WebSocket closed');
            }
        };
    }, []);

    useEffect(() => {
        if (wsRef.current) {
            wsRef.current.onmessage = (event: any) => {
                const message = JSON.parse(event.data);
                console.log(message);
                // switch (message.action) {
                //     case "create_ticket":
                //         const data: Ticket = message.data;
                //         data.statusText = statusToText(data.status);
                //         data.adminName = adminIdToName(data.admin_id, state.admins);
                //         localDispatch({
                //             type: 'ADD_TICKET',
                //             payload: message.data,
                //         });
                //         state.files.forEach(async (file: File) => {
                //             const formData = new FormData();
                //             formData.append("file", file);
                //             try {
                //                 const response = await apiStorage.post("/file", formData, {
                //                     headers: {
                //                         "Content-Type": "multipart/form-data",
                //                     },
                //                 });
                //
                //                 const payload = {
                //                     action: 'add_file_to_ticket',
                //                     data: {
                //                         item_id: data.id,
                //                         file_uuid: response.data.uuid,
                //                         file_name: response.data.name,
                //                         file_size: response.data.size,
                //                     }
                //                 }
                //                 if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                //                     wsRef.current.send(JSON.stringify(payload));
                //                 } else {
                //                     dispatch(setAppError("WebSocket error"));
                //                 }
                //             } catch (error: unknown) {
                //                 if (error instanceof Error) {
                //                     dispatch(setAppError(error.message));
                //                 } else {
                //                     dispatch(setAppError("An unknown error occurred"));
                //                 }
                //             }
                //         })
                //         break;
                //     case "add_file_to_ticket":
                //         break;
                //     default:
                //         dispatch(setAppError("Unknown message type received via WebSocket"));
                //         break;
                // }
            };
        }
    }, [state.files]);

    return (
        <>
            <div className="p-4 flex justify-center pb-20">
                <div className={'max-w-xl w-full gap-2 flex flex-col border border-gray-300 p-4'}>
                    <button
                        className={'border border-gray-300 px-4 cursor-pointer hover:bg-gray-300 transition-colors duration-200'}
                        onClick={() => navigate(`/messenger`)}
                    >
                        Back
                    </button>
                    <div className={'border border-gray-300 p-4'}>
                        Ticket info
                    </div>
                    <div className={'border border-gray-300 p-4'}>
                        <div>Message</div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default PageMessengerChat;
