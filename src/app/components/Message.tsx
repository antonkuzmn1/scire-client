import {AppDispatch, RootState} from "../../utils/store.ts";
import {useDispatch, useSelector} from "react-redux";
import {setAppMessage} from "../../slices/appSlice.ts";
import Dialog from "./Dialog.tsx";
import {useTranslation} from "react-i18next";

const Message = () => {
    const dispatch: AppDispatch = useDispatch();
    const {t} = useTranslation();

    const message = useSelector((state: RootState) => state.app.message);

    if (message.length === 0) return null;

    return (
        <Dialog
            title={t("message_title")}
            close={() => dispatch(setAppMessage(""))}
            message={message}
            buttons={[
                {text: t("message_button_close"), onClick: () => dispatch(setAppMessage(""))},
            ]}
        />
    );
};

export default Message;
