import {AppDispatch, RootState} from "../../utils/store.ts";
import {useDispatch, useSelector} from "react-redux";
import {setAppError} from "../../slices/appSlice.ts";
import Dialog from "./Dialog.tsx";
import {useTranslation} from "react-i18next";

const ErrorMessage = () => {
    const dispatch: AppDispatch = useDispatch();
    const {t} = useTranslation();

    const error = useSelector((state: RootState) => state.app.error);

    if (error.length === 0) return null;

    return (
        <Dialog
            title={t("error_message_title")}
            close={() => dispatch(setAppError(""))}
            message={error}
            buttons={[
                {text: t("error_message_button_close"), onClick: () => dispatch(setAppError(""))},
            ]}
        />
    );
};

export default ErrorMessage;
