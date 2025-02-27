import React from "react";

export interface ContentProps {
    element: any;
}

const Page: React.FC<ContentProps> = (props: ContentProps) => {

    return (
        <div>{props.element}</div>
    )
}

export default Page
