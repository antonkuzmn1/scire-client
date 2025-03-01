import React, {useCallback, useEffect, useReducer, useState} from "react";
import {AppDispatch} from "../../utils/store.ts";
import {useDispatch} from "react-redux";
import Cookies from "js-cookie";
import axios from "axios";
import {setAccountAuthorized} from "../../slices/accountSlice.ts";
import {setAppError} from "../../slices/appSlice.ts";
import {dateToString} from "../../utils/formatDate.ts";
import Input from "../components/Input.tsx";
import {apiOauth} from "../../utils/api.ts";
import LoadingSpinner from "../components/LoadingSpinner.tsx";
import {useNavigate} from "react-router-dom";

interface Company {
    id: number;
    username: string;
    description: string;
    created_at: string | null;
    updated_at: string | null;
}

interface Data {
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
    company: Company;
    companyName: string;
    created_at: string | null;
    updated_at: string | null;
}


interface State {
    data: Data;
}

type Action =
    | { type: 'SET_DATA', payload: Data }

const defaultCompany = {id: 0, username: '', description: '', created_at: null, updated_at: null};

const defaultData = {
    id: 0,
    username: '',
    password: '',
    surname: '',
    name: '',
    middlename: null,
    department: null,
    local_workplace: null,
    remote_workplace: null,
    phone: null,
    cellular: null,
    post: null,
    company: defaultCompany,
    companyName: '',
    created_at: null,
    updated_at: null
}

const initialState: State = {
    data: defaultData,
}

const reducer = (state: State, action: Action) => {
    switch (action.type) {
        case 'SET_DATA':
            return {
                ...state,
                data: action.payload,
            };
        default:
            return state;
    }
}

const fields: { label: string, type: string, key: keyof Data }[] = [
    {label: "ID", type: "string", key: "id"},
    {label: "Username", type: "string", key: "username"},
    {label: "Password", type: "password", key: "password"},
    {label: "Surname", type: "string", key: "surname"},
    {label: "Name", type: "string", key: "name"},
    {label: "Middlename", type: "string", key: "middlename"},
    {label: "Department", type: "string", key: "department"},
    {label: "Local workplace", type: "string", key: "local_workplace"},
    {label: "Remote workplace", type: "string", key: "remote_workplace"},
    {label: "Phone", type: "string", key: "phone"},
    {label: "Cellular", type: "string", key: "cellular"},
    {label: "Post", type: "string", key: "post"},
    {label: "Company", type: "string", key: "companyName"},
    {label: "Created at", type: "date", key: "created_at"},
    {label: "Updated at", type: "date", key: "updated_at"}
];

const PageMe: React.FC = () => {
    const dispatch: AppDispatch = useDispatch();
    const [state, localDispatch] = useReducer(reducer, initialState);
    const [initDone, setInitDone] = useState<boolean>(false);
    const navigate = useNavigate();

    const init = useCallback(async () => {
        setInitDone(false);
        try {
            const response = await apiOauth.get("/users/profile");
            const data = {
                ...response.data,
                companyName: response.data.company.username,
            }
            localDispatch({type: "SET_DATA", payload: data});
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

    const logout = () => {
        Cookies.remove('token');
        delete axios.defaults.headers.common['Authorization'];
        dispatch(setAccountAuthorized(false));
    }

    if (!initDone) return <LoadingSpinner/>;

    return (
        <>
            <div className="p-4 flex justify-center max-h-dvh overflow-y-auto hide-scrollbar">
                <div className={'max-w-xl w-full gap-2 flex flex-col h-full pb-10'}>
                    {fields.map((field, index) => {
                        if (field.type === "date") return (
                            <Input
                                key={index}
                                label={field.label}
                                type={'text'}
                                placeholder={'Empty'}
                                value={
                                    state.data[field.key]
                                        ? dateToString(new Date(String(state.data[field.key])))
                                        : ''
                                }
                                readOnly={true}
                            />
                        )
                        return (
                            <Input
                                key={index}
                                label={field.label}
                                type={field.type}
                                placeholder={'Empty'}
                                value={String(state.data[field.key])}
                                readOnly={true}
                            />
                        )
                    })}
                    <div className={"w-full fixed bottom-0 left-0 flex justify-center"}>
                        <div className={"flex min-h-12 w-full max-w-xl bg-white border border-gray-300"}>
                            <button
                                className={"flex items-center justify-center w-full cursor-pointer hover:bg-gray-300 transition-colors duration-200 text-gray-600"}
                                onClick={() => navigate('/')}
                            >
                                Back
                            </button>
                            <button
                                className={"flex items-center justify-center w-full cursor-pointer hover:bg-gray-300 transition-colors duration-200 text-gray-600"}
                                onClick={logout}
                            >
                                Log out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default PageMe;
