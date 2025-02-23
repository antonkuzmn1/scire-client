import React, {useCallback, useEffect, useReducer} from "react";
import {AppDispatch} from "../../utils/store.ts";
import {useDispatch} from "react-redux";
import Cookies from "js-cookie";
import axios from "axios";
import {setAccountAuthorized} from "../../slices/accountSlice.ts";
import {setAppError, setAppLoading} from "../../slices/appSlice.ts";
import {dateToString} from "../../utils/formatDate.ts";
import Input from "../components/Input.tsx";
import {apiOauth} from "../../utils/api.ts";

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

const initialState: State = {
    data: {
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
        company: {id: 0, username: '', description: '', created_at: null, updated_at: null},
        companyName: '',
        created_at: null,
        updated_at: null
    },
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

const PageMe: React.FC = () => {
    const dispatch: AppDispatch = useDispatch();
    const [state, localDispatch] = useReducer(reducer, initialState);

    const getData = useCallback(async () => {
        dispatch(setAppLoading(true));
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
            dispatch(setAppLoading(false));
        }
    }, []);

    useEffect(() => {
        getData().then();
    }, [getData]);

    const logout = () => {
        Cookies.remove('token');
        delete axios.defaults.headers.common['Authorization'];
        dispatch(setAccountAuthorized(false));
    }

    return (
        <>
            <div className="p-4 flex justify-center pb-20">
                <div className={'max-w-xl w-full gap-2 flex flex-col'}>
                    <Input
                        label={'ID'}
                        type={'number'}
                        placeholder={'Empty'}
                        value={state.data.id}
                        readOnly={true}
                    />
                    <Input
                        label={'Username'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.username}
                        readOnly={true}
                    />
                    <Input
                        label={'Password'}
                        type={'password'}
                        placeholder={'Empty'}
                        value={state.data.password}
                        readOnly={true}
                    />
                    <Input
                        label={'Surname'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.surname}
                        readOnly={true}
                    />
                    <Input
                        label={'Name'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.name}
                        readOnly={true}
                    />
                    <Input
                        label={'Middlename'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.middlename || ''}
                        readOnly={true}
                    />
                    <Input
                        label={'Department'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.department || ''}
                        readOnly={true}
                    />
                    <Input
                        label={'Local workplace'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.local_workplace || ''}
                        readOnly={true}
                    />
                    <Input
                        label={'Remote workplace'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.remote_workplace || ''}
                        readOnly={true}
                    />
                    <Input
                        label={'Phone'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.phone || ''}
                        readOnly={true}
                    />
                    <Input
                        label={'Cellular'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.cellular || ''}
                        readOnly={true}
                    />
                    <Input
                        label={'Post'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.post || ''}
                        readOnly={true}
                    />
                    <Input
                        label={'Companies'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.companyName || ''}
                        readOnly={true}
                    />
                    <Input
                        label={'Created'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.created_at ? dateToString(new Date(state.data.created_at)) : ''}
                        readOnly={true}
                    />
                    <Input
                        label={'Updated'}
                        type={'text'}
                        placeholder={'Empty'}
                        value={state.data.updated_at ? dateToString(new Date(state.data.updated_at)) : ''}
                        readOnly={true}
                    />
                    <div className="flex w-full h-12 gap-2">
                        <button
                            className="border border-gray-300 flex items-center justify-center w-full hover:bg-gray-300 transition-colors duration-200 text-gray-600"
                            onClick={logout}
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default PageMe;
