import express, {
    type Application,
    type Request,
    type Response,
    type NextFunction,
} from "express";
const app: Application = express();
import CookieParser from "cookie-parser"
import cors from "cors";
import { authRoute } from "./modules/auth/auth.route";
import { issueRoutes } from "./modules/issue/issue.route";
import globalErrorHandler from "./middleware/globalErrorHandler";

app.use(CookieParser());
app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({extended: true}));
// app.use(logger);

app.use(cors({
    origin: "http://localhost:3000", 
    credentials: true,
}));

app.get("/", async (req: Request, res: Response) => {
    res.status(200).json({
        message: "expres server",
        author: "next-level",
    });
});


app.use("/api/auth", authRoute);

app.use("/api/issues", issueRoutes);


app.use(globalErrorHandler);

export default app;
 