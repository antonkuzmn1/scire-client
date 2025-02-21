import React, {ReactNode, useCallback, useEffect, useReducer} from "react";
import {AppDispatch} from "../../utils/store.ts";
import {useDispatch} from "react-redux";
import Cookies from "js-cookie";
import axios from "axios";
import {setAccountAuthorized} from "../../slices/accountSlice.ts";
import {setAppError, setAppLoading, setAppMessage} from "../../slices/appSlice.ts";
import {dateToString} from "../../utils/formatDate.ts";
import Input from "../components/Input.tsx";
import Dialog from "../components/Dialog.tsx";
import {apiOauth} from "../../utils/api.ts";

interface Data {
    id: number;
    username: string;
    created_at: string | null;
    updated_at: string | null;
}

interface Password {
    password: string;
    passwordConfirmation: string;
}

interface State {
    data: Data;
    dialog: 'update' | null;
    password: Password;
}

type Action =
    | { type: 'SET_DATA', payload: Data }
    | { type: "OPEN_DIALOG", payload: { dialog: 'update', password?: Password } }
    | { type: 'CLOSE_DIALOG' }
    | { type: 'UPDATE_DATA', payload: Partial<Data> }
    | { type: 'UPDATE_PASSWORD', payload: Partial<Password> };

const initialState: State = {
    data: {id: 0, username: '', created_at: null, updated_at: null},
    dialog: null,
    password: {password: '', passwordConfirmation: ''},
}

const reducer = (state: State, action: Action) => {
    switch (action.type) {
        case 'SET_DATA':
            return {
                ...state,
                data: action.payload,
            };
        case "OPEN_DIALOG":
            return {
                ...state,
                dialog: action.payload.dialog,
                password: {password: '', passwordConfirmation: ''}
            };
        case "CLOSE_DIALOG":
            return {
                ...state,
                dialog: null,
                password: {password: '', passwordConfirmation: ''}
            };
        case 'UPDATE_DATA':
            return {
                ...state,
                data: {...state.data, ...action.payload},
            }
        case 'UPDATE_PASSWORD':
            return {
                ...state,
                password: {...state.password, ...action.payload},
            }
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
            const response = await apiOauth.get("/owner/profile");
            localDispatch({type: "SET_DATA", payload: response.data});
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

    const openDialog = useCallback((dialog: 'update', password?: Password) => {
        localDispatch({type: "OPEN_DIALOG", payload: {dialog, password}});
    }, []);

    const closeDialog = useCallback(() => {
        localDispatch({type: "CLOSE_DIALOG"});
    }, []);

    const updateData = useCallback(async () => {
        if (!state.password.password || !state.password.passwordConfirmation) {
            dispatch(setAppError('Password required'));
            return;
        }

        if (state.password.password !== state.password.passwordConfirmation) {
            dispatch(setAppError('Password is not equals'));
            return;
        }

        dispatch(setAppLoading(true));
        try {
            const response = await apiOauth.put(`/owner/${state.data.id}`, {
                username: state.data.username,
                password: state.password.password,
            });
            localDispatch({type: "UPDATE_DATA", payload: response.data});
            dispatch(setAppMessage('Password updated'));
        } catch (error: unknown) {
            if (error instanceof Error) {
                dispatch(setAppError(error.message));
            } else {
                dispatch(setAppError("An unknown error occurred"));
            }
        } finally {
            dispatch(setAppLoading(false));
        }
    }, [state.data, state.password, dispatch]);

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
                        <button
                            className="border border-gray-300 flex items-center justify-center w-full hover:bg-gray-300 transition-colors duration-200 text-gray-600"
                            onClick={() => openDialog('update', {password: '', passwordConfirmation: ''})}
                        >
                            Change password
                        </button>
                    </div>
                </div>
            </div>
            {state.dialog && (
                <DialogActions
                    type={state.dialog}
                    closeDialog={closeDialog}
                    action={updateData}
                    dialogFields={<>
                        <Input
                            label={'Password'}
                            type={'password'}
                            placeholder={'Enter new password'}
                            value={state.password.password || ''}
                            onChange={(e) => localDispatch({
                                type: 'UPDATE_PASSWORD',
                                payload: {password: e.target.value}
                            })}
                        />
                        <Input
                            label={'Confirm'}
                            type={'password'}
                            placeholder={'Confirm password'}
                            value={state.password.passwordConfirmation || ''}
                            onChange={(e) => localDispatch({
                                type: 'UPDATE_PASSWORD',
                                payload: {passwordConfirmation: e.target.value}
                            })}
                        />
                    </>}
                />
            )}
        </>
    )
}

export default PageMe;

interface DialogActionsProps {
    type: 'update'
    closeDialog: () => void;
    action: () => void;
    dialogFields?: ReactNode;
}

const DialogActions: React.FC<DialogActionsProps> = ({type, closeDialog, action, dialogFields}) => {
    switch (type) {
        case "update":
            return (
                <Dialog
                    close={closeDialog}
                    title={"Update password"}
                    buttons={[
                        {text: "Cancel", onClick: closeDialog},
                        {text: "Update", onClick: action},
                    ]}
                    children={dialogFields}
                />
            );
        default:
            return null
    }
}
