import { createContext, useContext } from "react";
import type { RecordData } from "./api";
export const UserContext = createContext<RecordData>({});
export const useUser = () => useContext(UserContext);
