import React from "react";
import Input from "../components/Input.tsx";

const PageConfig: React.FC = () => {
    return (
        <div className="p-4 flex justify-center">
            <div className={'max-w-xl w-full gap-4 flex flex-col'}>
                <Input
                    label={'Key'}
                    type={'text'}
                    value={'Value'}
                    readOnly={true}
                />
            </div>
        </div>
    )
}

export default PageConfig;
