import axios from "axios";

export const apiOauth = axios.create({
    baseURL: 'https://oauth.antonkuzm.in',
});

export const apiStorage = axios.create({
    baseURL: 'https://storage.antonkuzm.in',
});
