import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AccountManager, ActivityDetail, ActivityOverview, AuthResponse, CreateAccountManagerBody, ErrorResponse, FunnelDetail, FunnelOverview, GenerateTelegramCodeBody, GetActivityByNikParams, GetFunnelByNikParams, GetPerformanceByNikParams, GetPublicAmProfileParams, HealthStatus, ImportRecord, ImportResult, ImportUrlBody, ListActivityParams, ListFunnelParams, ListPerformanceParams, LoginBody, OfficerProfile, OtpChallengeResponse, OtpRequestBody, OtpVerifyBody, PerformanceDetail, PerformanceSummary, PresentationLoginBody, PresentationLoginResponse, PresentationSessionBody, PublicAmProfile, SendTelegramBody, Settings, SuccessResponse, TelegramCodeResponse, TelegramLog, TelegramSendResult, UpdateAccountManagerBody, UpdateSettingsBody } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getLoginUrl: () => string;
/**
 * @summary Admin login
 */
export declare const login: (loginBody: LoginBody, options?: Parameters<typeof customFetch>[1]) => Promise<AuthResponse>;
export declare const getLoginMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginBody>;
}, TContext>;
export type LoginMutationResult = NonNullable<Awaited<ReturnType<typeof login>>>;
export type LoginMutationBody = BodyType<LoginBody>;
export type LoginMutationError = ErrorType<ErrorResponse>;
/**
* @summary Admin login
*/
export declare const useLogin: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginBody>;
}, TContext>;
export declare const getLogoutUrl: () => string;
/**
 * @summary Logout
 */
export declare const logout: (options?: Parameters<typeof customFetch>[1]) => Promise<SuccessResponse>;
export declare const getLogoutMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
export type LogoutMutationResult = NonNullable<Awaited<ReturnType<typeof logout>>>;
export type LogoutMutationError = ErrorType<unknown>;
/**
* @summary Logout
*/
export declare const useLogout: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
export declare const getGetMeUrl: () => string;
/**
 * @summary Get current user
 */
export declare const getMe: (options?: Parameters<typeof customFetch>[1]) => Promise<AuthResponse>;
export declare const getGetMeQueryKey: () => readonly ["/api/auth/me"];
export declare const getGetMeQueryOptions: <TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMeQueryResult = NonNullable<Awaited<ReturnType<typeof getMe>>>;
export type GetMeQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get current user
 */
export declare function useGetMe<TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getOtpRequestUrl: () => string;
/**
 * @summary Request OTP for login
 */
export declare const otpRequest: (otpRequestBody: OtpRequestBody, options?: Parameters<typeof customFetch>[1]) => Promise<OtpChallengeResponse>;
export declare const getOtpRequestMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof otpRequest>>, TError, {
        data: BodyType<OtpRequestBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof otpRequest>>, TError, {
    data: BodyType<OtpRequestBody>;
}, TContext>;
export type OtpRequestMutationResult = NonNullable<Awaited<ReturnType<typeof otpRequest>>>;
export type OtpRequestMutationBody = BodyType<OtpRequestBody>;
export type OtpRequestMutationError = ErrorType<ErrorResponse>;
/**
* @summary Request OTP for login
*/
export declare const useOtpRequest: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof otpRequest>>, TError, {
        data: BodyType<OtpRequestBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof otpRequest>>, TError, {
    data: BodyType<OtpRequestBody>;
}, TContext>;
export declare const getOtpVerifyUrl: () => string;
/**
 * @summary Verify OTP
 */
export declare const otpVerify: (otpVerifyBody: OtpVerifyBody, options?: Parameters<typeof customFetch>[1]) => Promise<AuthResponse>;
export declare const getOtpVerifyMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof otpVerify>>, TError, {
        data: BodyType<OtpVerifyBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof otpVerify>>, TError, {
    data: BodyType<OtpVerifyBody>;
}, TContext>;
export type OtpVerifyMutationResult = NonNullable<Awaited<ReturnType<typeof otpVerify>>>;
export type OtpVerifyMutationBody = BodyType<OtpVerifyBody>;
export type OtpVerifyMutationError = ErrorType<ErrorResponse>;
/**
* @summary Verify OTP
*/
export declare const useOtpVerify: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof otpVerify>>, TError, {
        data: BodyType<OtpVerifyBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof otpVerify>>, TError, {
    data: BodyType<OtpVerifyBody>;
}, TContext>;
export declare const getOtpResendUrl: () => string;
/**
 * @summary Resend OTP
 */
export declare const otpResend: (options?: Parameters<typeof customFetch>[1]) => Promise<OtpChallengeResponse>;
export declare const getOtpResendMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof otpResend>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof otpResend>>, TError, void, TContext>;
export type OtpResendMutationResult = NonNullable<Awaited<ReturnType<typeof otpResend>>>;
export type OtpResendMutationError = ErrorType<ErrorResponse>;
/**
* @summary Resend OTP
*/
export declare const useOtpResend: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof otpResend>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof otpResend>>, TError, void, TContext>;
export declare const getListOfficersUrl: () => string;
/**
 * @summary List officers with Telegram connected
 */
export declare const listOfficers: (options?: Parameters<typeof customFetch>[1]) => Promise<OfficerProfile[]>;
export declare const getListOfficersQueryKey: () => readonly ["/api/auth/officers"];
export declare const getListOfficersQueryOptions: <TData = Awaited<ReturnType<typeof listOfficers>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listOfficers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listOfficers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListOfficersQueryResult = NonNullable<Awaited<ReturnType<typeof listOfficers>>>;
export type ListOfficersQueryError = ErrorType<unknown>;
/**
 * @summary List officers with Telegram connected
 */
export declare function useListOfficers<TData = Awaited<ReturnType<typeof listOfficers>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listOfficers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getPresentationRequestOtpUrl: () => string;
/**
 * @summary Presentation mode: request OTP by NIK
 */
export declare const presentationRequestOtp: (presentationLoginBody: PresentationLoginBody, options?: Parameters<typeof customFetch>[1]) => Promise<PresentationLoginResponse>;
export declare const getPresentationRequestOtpMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof presentationRequestOtp>>, TError, {
        data: BodyType<PresentationLoginBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof presentationRequestOtp>>, TError, {
    data: BodyType<PresentationLoginBody>;
}, TContext>;
export type PresentationRequestOtpMutationResult = NonNullable<Awaited<ReturnType<typeof presentationRequestOtp>>>;
export type PresentationRequestOtpMutationBody = BodyType<PresentationLoginBody>;
export type PresentationRequestOtpMutationError = ErrorType<ErrorResponse>;
/**
* @summary Presentation mode: request OTP by NIK
*/
export declare const usePresentationRequestOtp: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof presentationRequestOtp>>, TError, {
        data: BodyType<PresentationLoginBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof presentationRequestOtp>>, TError, {
    data: BodyType<PresentationLoginBody>;
}, TContext>;
export declare const getPresentationVerifyOtpUrl: () => string;
/**
 * @summary Presentation mode: verify OTP
 */
export declare const presentationVerifyOtp: (otpVerifyBody: OtpVerifyBody, options?: Parameters<typeof customFetch>[1]) => Promise<AuthResponse>;
export declare const getPresentationVerifyOtpMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof presentationVerifyOtp>>, TError, {
        data: BodyType<OtpVerifyBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof presentationVerifyOtp>>, TError, {
    data: BodyType<OtpVerifyBody>;
}, TContext>;
export type PresentationVerifyOtpMutationResult = NonNullable<Awaited<ReturnType<typeof presentationVerifyOtp>>>;
export type PresentationVerifyOtpMutationBody = BodyType<OtpVerifyBody>;
export type PresentationVerifyOtpMutationError = ErrorType<ErrorResponse>;
/**
* @summary Presentation mode: verify OTP
*/
export declare const usePresentationVerifyOtp: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof presentationVerifyOtp>>, TError, {
        data: BodyType<OtpVerifyBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof presentationVerifyOtp>>, TError, {
    data: BodyType<OtpVerifyBody>;
}, TContext>;
export declare const getValidatePresentationSessionUrl: () => string;
/**
 * @summary Validate presentation session token
 */
export declare const validatePresentationSession: (presentationSessionBody: PresentationSessionBody, options?: Parameters<typeof customFetch>[1]) => Promise<AuthResponse>;
export declare const getValidatePresentationSessionMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof validatePresentationSession>>, TError, {
        data: BodyType<PresentationSessionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof validatePresentationSession>>, TError, {
    data: BodyType<PresentationSessionBody>;
}, TContext>;
export type ValidatePresentationSessionMutationResult = NonNullable<Awaited<ReturnType<typeof validatePresentationSession>>>;
export type ValidatePresentationSessionMutationBody = BodyType<PresentationSessionBody>;
export type ValidatePresentationSessionMutationError = ErrorType<ErrorResponse>;
/**
* @summary Validate presentation session token
*/
export declare const useValidatePresentationSession: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof validatePresentationSession>>, TError, {
        data: BodyType<PresentationSessionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof validatePresentationSession>>, TError, {
    data: BodyType<PresentationSessionBody>;
}, TContext>;
export declare const getInvalidatePresentationSessionUrl: () => string;
/**
 * @summary Logout from presentation mode
 */
export declare const invalidatePresentationSession: (options?: Parameters<typeof customFetch>[1]) => Promise<SuccessResponse>;
export declare const getInvalidatePresentationSessionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof invalidatePresentationSession>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof invalidatePresentationSession>>, TError, void, TContext>;
export type InvalidatePresentationSessionMutationResult = NonNullable<Awaited<ReturnType<typeof invalidatePresentationSession>>>;
export type InvalidatePresentationSessionMutationError = ErrorType<unknown>;
/**
* @summary Logout from presentation mode
*/
export declare const useInvalidatePresentationSession: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof invalidatePresentationSession>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof invalidatePresentationSession>>, TError, void, TContext>;
export declare const getListAccountManagersUrl: () => string;
/**
 * @summary List all account managers
 */
export declare const listAccountManagers: (options?: Parameters<typeof customFetch>[1]) => Promise<AccountManager[]>;
export declare const getListAccountManagersQueryKey: () => readonly ["/api/am"];
export declare const getListAccountManagersQueryOptions: <TData = Awaited<ReturnType<typeof listAccountManagers>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAccountManagers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAccountManagers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAccountManagersQueryResult = NonNullable<Awaited<ReturnType<typeof listAccountManagers>>>;
export type ListAccountManagersQueryError = ErrorType<unknown>;
/**
 * @summary List all account managers
 */
export declare function useListAccountManagers<TData = Awaited<ReturnType<typeof listAccountManagers>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAccountManagers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateAccountManagerUrl: () => string;
/**
 * @summary Create account manager
 */
export declare const createAccountManager: (createAccountManagerBody: CreateAccountManagerBody, options?: Parameters<typeof customFetch>[1]) => Promise<AccountManager>;
export declare const getCreateAccountManagerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAccountManager>>, TError, {
        data: BodyType<CreateAccountManagerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAccountManager>>, TError, {
    data: BodyType<CreateAccountManagerBody>;
}, TContext>;
export type CreateAccountManagerMutationResult = NonNullable<Awaited<ReturnType<typeof createAccountManager>>>;
export type CreateAccountManagerMutationBody = BodyType<CreateAccountManagerBody>;
export type CreateAccountManagerMutationError = ErrorType<unknown>;
/**
* @summary Create account manager
*/
export declare const useCreateAccountManager: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAccountManager>>, TError, {
        data: BodyType<CreateAccountManagerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createAccountManager>>, TError, {
    data: BodyType<CreateAccountManagerBody>;
}, TContext>;
export declare const getGetAccountManagerUrl: (id: number) => string;
/**
 * @summary Get account manager by ID
 */
export declare const getAccountManager: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<AccountManager>;
export declare const getGetAccountManagerQueryKey: (id: number) => readonly [`/api/am/${number}`];
export declare const getGetAccountManagerQueryOptions: <TData = Awaited<ReturnType<typeof getAccountManager>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAccountManager>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAccountManager>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAccountManagerQueryResult = NonNullable<Awaited<ReturnType<typeof getAccountManager>>>;
export type GetAccountManagerQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get account manager by ID
 */
export declare function useGetAccountManager<TData = Awaited<ReturnType<typeof getAccountManager>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAccountManager>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateAccountManagerUrl: (id: number) => string;
/**
 * @summary Update account manager
 */
export declare const updateAccountManager: (id: number, updateAccountManagerBody: UpdateAccountManagerBody, options?: Parameters<typeof customFetch>[1]) => Promise<AccountManager>;
export declare const getUpdateAccountManagerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAccountManager>>, TError, {
        id: number;
        data: BodyType<UpdateAccountManagerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateAccountManager>>, TError, {
    id: number;
    data: BodyType<UpdateAccountManagerBody>;
}, TContext>;
export type UpdateAccountManagerMutationResult = NonNullable<Awaited<ReturnType<typeof updateAccountManager>>>;
export type UpdateAccountManagerMutationBody = BodyType<UpdateAccountManagerBody>;
export type UpdateAccountManagerMutationError = ErrorType<unknown>;
/**
* @summary Update account manager
*/
export declare const useUpdateAccountManager: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAccountManager>>, TError, {
        id: number;
        data: BodyType<UpdateAccountManagerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateAccountManager>>, TError, {
    id: number;
    data: BodyType<UpdateAccountManagerBody>;
}, TContext>;
export declare const getDeleteAccountManagerUrl: (id: number) => string;
/**
 * @summary Delete account manager
 */
export declare const deleteAccountManager: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeleteAccountManagerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAccountManager>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteAccountManager>>, TError, {
    id: number;
}, TContext>;
export type DeleteAccountManagerMutationResult = NonNullable<Awaited<ReturnType<typeof deleteAccountManager>>>;
export type DeleteAccountManagerMutationError = ErrorType<unknown>;
/**
* @summary Delete account manager
*/
export declare const useDeleteAccountManager: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAccountManager>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteAccountManager>>, TError, {
    id: number;
}, TContext>;
export declare const getListImportHistoryUrl: () => string;
/**
 * @summary List import history
 */
export declare const listImportHistory: (options?: Parameters<typeof customFetch>[1]) => Promise<ImportRecord[]>;
export declare const getListImportHistoryQueryKey: () => readonly ["/api/import/history"];
export declare const getListImportHistoryQueryOptions: <TData = Awaited<ReturnType<typeof listImportHistory>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listImportHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listImportHistory>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListImportHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof listImportHistory>>>;
export type ListImportHistoryQueryError = ErrorType<unknown>;
/**
 * @summary List import history
 */
export declare function useListImportHistory<TData = Awaited<ReturnType<typeof listImportHistory>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listImportHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getImportPerformanceUrl: () => string;
/**
 * @summary Import performance data from Excel
 */
export declare const importPerformance: (importUrlBody: ImportUrlBody, options?: Parameters<typeof customFetch>[1]) => Promise<ImportResult>;
export declare const getImportPerformanceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof importPerformance>>, TError, {
        data: BodyType<ImportUrlBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof importPerformance>>, TError, {
    data: BodyType<ImportUrlBody>;
}, TContext>;
export type ImportPerformanceMutationResult = NonNullable<Awaited<ReturnType<typeof importPerformance>>>;
export type ImportPerformanceMutationBody = BodyType<ImportUrlBody>;
export type ImportPerformanceMutationError = ErrorType<unknown>;
/**
* @summary Import performance data from Excel
*/
export declare const useImportPerformance: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof importPerformance>>, TError, {
        data: BodyType<ImportUrlBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof importPerformance>>, TError, {
    data: BodyType<ImportUrlBody>;
}, TContext>;
export declare const getImportFunnelUrl: () => string;
/**
 * @summary Import sales funnel data from Excel
 */
export declare const importFunnel: (importUrlBody: ImportUrlBody, options?: Parameters<typeof customFetch>[1]) => Promise<ImportResult>;
export declare const getImportFunnelMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof importFunnel>>, TError, {
        data: BodyType<ImportUrlBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof importFunnel>>, TError, {
    data: BodyType<ImportUrlBody>;
}, TContext>;
export type ImportFunnelMutationResult = NonNullable<Awaited<ReturnType<typeof importFunnel>>>;
export type ImportFunnelMutationBody = BodyType<ImportUrlBody>;
export type ImportFunnelMutationError = ErrorType<unknown>;
/**
* @summary Import sales funnel data from Excel
*/
export declare const useImportFunnel: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof importFunnel>>, TError, {
        data: BodyType<ImportUrlBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof importFunnel>>, TError, {
    data: BodyType<ImportUrlBody>;
}, TContext>;
export declare const getImportActivityUrl: () => string;
/**
 * @summary Import sales activity data from Excel
 */
export declare const importActivity: (importUrlBody: ImportUrlBody, options?: Parameters<typeof customFetch>[1]) => Promise<ImportResult>;
export declare const getImportActivityMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof importActivity>>, TError, {
        data: BodyType<ImportUrlBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof importActivity>>, TError, {
    data: BodyType<ImportUrlBody>;
}, TContext>;
export type ImportActivityMutationResult = NonNullable<Awaited<ReturnType<typeof importActivity>>>;
export type ImportActivityMutationBody = BodyType<ImportUrlBody>;
export type ImportActivityMutationError = ErrorType<unknown>;
/**
* @summary Import sales activity data from Excel
*/
export declare const useImportActivity: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof importActivity>>, TError, {
        data: BodyType<ImportUrlBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof importActivity>>, TError, {
    data: BodyType<ImportUrlBody>;
}, TContext>;
export declare const getListPerformanceUrl: (params?: ListPerformanceParams) => string;
/**
 * @summary Get performance data for all AMs
 */
export declare const listPerformance: (params?: ListPerformanceParams, options?: Parameters<typeof customFetch>[1]) => Promise<PerformanceSummary[]>;
export declare const getListPerformanceQueryKey: (params?: ListPerformanceParams) => readonly ["/api/performance", ...ListPerformanceParams[]];
export declare const getListPerformanceQueryOptions: <TData = Awaited<ReturnType<typeof listPerformance>>, TError = ErrorType<unknown>>(params?: ListPerformanceParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPerformance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPerformance>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPerformanceQueryResult = NonNullable<Awaited<ReturnType<typeof listPerformance>>>;
export type ListPerformanceQueryError = ErrorType<unknown>;
/**
 * @summary Get performance data for all AMs
 */
export declare function useListPerformance<TData = Awaited<ReturnType<typeof listPerformance>>, TError = ErrorType<unknown>>(params?: ListPerformanceParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPerformance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPerformanceByNikUrl: (nik: string, params?: GetPerformanceByNikParams) => string;
/**
 * @summary Get performance data for specific AM
 */
export declare const getPerformanceByNik: (nik: string, params?: GetPerformanceByNikParams, options?: Parameters<typeof customFetch>[1]) => Promise<PerformanceDetail>;
export declare const getGetPerformanceByNikQueryKey: (nik: string, params?: GetPerformanceByNikParams) => readonly [`/api/performance/${string}`, ...GetPerformanceByNikParams[]];
export declare const getGetPerformanceByNikQueryOptions: <TData = Awaited<ReturnType<typeof getPerformanceByNik>>, TError = ErrorType<ErrorResponse>>(nik: string, params?: GetPerformanceByNikParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPerformanceByNik>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPerformanceByNik>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPerformanceByNikQueryResult = NonNullable<Awaited<ReturnType<typeof getPerformanceByNik>>>;
export type GetPerformanceByNikQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get performance data for specific AM
 */
export declare function useGetPerformanceByNik<TData = Awaited<ReturnType<typeof getPerformanceByNik>>, TError = ErrorType<ErrorResponse>>(nik: string, params?: GetPerformanceByNikParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPerformanceByNik>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListFunnelUrl: (params?: ListFunnelParams) => string;
/**
 * @summary Get funnel summary for all AMs
 */
export declare const listFunnel: (params?: ListFunnelParams, options?: Parameters<typeof customFetch>[1]) => Promise<FunnelOverview>;
export declare const getListFunnelQueryKey: (params?: ListFunnelParams) => readonly ["/api/funnel", ...ListFunnelParams[]];
export declare const getListFunnelQueryOptions: <TData = Awaited<ReturnType<typeof listFunnel>>, TError = ErrorType<unknown>>(params?: ListFunnelParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFunnel>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listFunnel>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListFunnelQueryResult = NonNullable<Awaited<ReturnType<typeof listFunnel>>>;
export type ListFunnelQueryError = ErrorType<unknown>;
/**
 * @summary Get funnel summary for all AMs
 */
export declare function useListFunnel<TData = Awaited<ReturnType<typeof listFunnel>>, TError = ErrorType<unknown>>(params?: ListFunnelParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFunnel>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetFunnelByNikUrl: (nik: string, params?: GetFunnelByNikParams) => string;
/**
 * @summary Get funnel data for specific AM
 */
export declare const getFunnelByNik: (nik: string, params?: GetFunnelByNikParams, options?: Parameters<typeof customFetch>[1]) => Promise<FunnelDetail>;
export declare const getGetFunnelByNikQueryKey: (nik: string, params?: GetFunnelByNikParams) => readonly [`/api/funnel/${string}`, ...GetFunnelByNikParams[]];
export declare const getGetFunnelByNikQueryOptions: <TData = Awaited<ReturnType<typeof getFunnelByNik>>, TError = ErrorType<unknown>>(nik: string, params?: GetFunnelByNikParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFunnelByNik>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFunnelByNik>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetFunnelByNikQueryResult = NonNullable<Awaited<ReturnType<typeof getFunnelByNik>>>;
export type GetFunnelByNikQueryError = ErrorType<unknown>;
/**
 * @summary Get funnel data for specific AM
 */
export declare function useGetFunnelByNik<TData = Awaited<ReturnType<typeof getFunnelByNik>>, TError = ErrorType<unknown>>(nik: string, params?: GetFunnelByNikParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFunnelByNik>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListActivityUrl: (params?: ListActivityParams) => string;
/**
 * @summary Get activity data for all AMs
 */
export declare const listActivity: (params?: ListActivityParams, options?: Parameters<typeof customFetch>[1]) => Promise<ActivityOverview>;
export declare const getListActivityQueryKey: (params?: ListActivityParams) => readonly ["/api/activity", ...ListActivityParams[]];
export declare const getListActivityQueryOptions: <TData = Awaited<ReturnType<typeof listActivity>>, TError = ErrorType<unknown>>(params?: ListActivityParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listActivity>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListActivityQueryResult = NonNullable<Awaited<ReturnType<typeof listActivity>>>;
export type ListActivityQueryError = ErrorType<unknown>;
/**
 * @summary Get activity data for all AMs
 */
export declare function useListActivity<TData = Awaited<ReturnType<typeof listActivity>>, TError = ErrorType<unknown>>(params?: ListActivityParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetActivityByNikUrl: (nik: string, params?: GetActivityByNikParams) => string;
/**
 * @summary Get activity data for specific AM
 */
export declare const getActivityByNik: (nik: string, params?: GetActivityByNikParams, options?: Parameters<typeof customFetch>[1]) => Promise<ActivityDetail>;
export declare const getGetActivityByNikQueryKey: (nik: string, params?: GetActivityByNikParams) => readonly [`/api/activity/${string}`, ...GetActivityByNikParams[]];
export declare const getGetActivityByNikQueryOptions: <TData = Awaited<ReturnType<typeof getActivityByNik>>, TError = ErrorType<unknown>>(nik: string, params?: GetActivityByNikParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getActivityByNik>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getActivityByNik>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetActivityByNikQueryResult = NonNullable<Awaited<ReturnType<typeof getActivityByNik>>>;
export type GetActivityByNikQueryError = ErrorType<unknown>;
/**
 * @summary Get activity data for specific AM
 */
export declare function useGetActivityByNik<TData = Awaited<ReturnType<typeof getActivityByNik>>, TError = ErrorType<unknown>>(nik: string, params?: GetActivityByNikParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getActivityByNik>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getSendTelegramUrl: () => string;
/**
 * @summary Send Telegram message to AMs
 */
export declare const sendTelegram: (sendTelegramBody: SendTelegramBody, options?: Parameters<typeof customFetch>[1]) => Promise<TelegramSendResult>;
export declare const getSendTelegramMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof sendTelegram>>, TError, {
        data: BodyType<SendTelegramBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof sendTelegram>>, TError, {
    data: BodyType<SendTelegramBody>;
}, TContext>;
export type SendTelegramMutationResult = NonNullable<Awaited<ReturnType<typeof sendTelegram>>>;
export type SendTelegramMutationBody = BodyType<SendTelegramBody>;
export type SendTelegramMutationError = ErrorType<unknown>;
/**
* @summary Send Telegram message to AMs
*/
export declare const useSendTelegram: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof sendTelegram>>, TError, {
        data: BodyType<SendTelegramBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof sendTelegram>>, TError, {
    data: BodyType<SendTelegramBody>;
}, TContext>;
export declare const getGetTelegramLogsUrl: () => string;
/**
 * @summary Get Telegram send logs
 */
export declare const getTelegramLogs: (options?: Parameters<typeof customFetch>[1]) => Promise<TelegramLog[]>;
export declare const getGetTelegramLogsQueryKey: () => readonly ["/api/telegram/logs"];
export declare const getGetTelegramLogsQueryOptions: <TData = Awaited<ReturnType<typeof getTelegramLogs>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTelegramLogs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTelegramLogs>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTelegramLogsQueryResult = NonNullable<Awaited<ReturnType<typeof getTelegramLogs>>>;
export type GetTelegramLogsQueryError = ErrorType<unknown>;
/**
 * @summary Get Telegram send logs
 */
export declare function useGetTelegramLogs<TData = Awaited<ReturnType<typeof getTelegramLogs>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTelegramLogs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGenerateTelegramCodeUrl: () => string;
/**
 * @summary Generate Telegram registration code for an AM
 */
export declare const generateTelegramCode: (generateTelegramCodeBody: GenerateTelegramCodeBody, options?: Parameters<typeof customFetch>[1]) => Promise<TelegramCodeResponse>;
export declare const getGenerateTelegramCodeMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateTelegramCode>>, TError, {
        data: BodyType<GenerateTelegramCodeBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateTelegramCode>>, TError, {
    data: BodyType<GenerateTelegramCodeBody>;
}, TContext>;
export type GenerateTelegramCodeMutationResult = NonNullable<Awaited<ReturnType<typeof generateTelegramCode>>>;
export type GenerateTelegramCodeMutationBody = BodyType<GenerateTelegramCodeBody>;
export type GenerateTelegramCodeMutationError = ErrorType<unknown>;
/**
* @summary Generate Telegram registration code for an AM
*/
export declare const useGenerateTelegramCode: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateTelegramCode>>, TError, {
        data: BodyType<GenerateTelegramCodeBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateTelegramCode>>, TError, {
    data: BodyType<GenerateTelegramCodeBody>;
}, TContext>;
export declare const getGetSettingsUrl: () => string;
/**
 * @summary Get system settings
 */
export declare const getSettings: (options?: Parameters<typeof customFetch>[1]) => Promise<Settings>;
export declare const getGetSettingsQueryKey: () => readonly ["/api/settings"];
export declare const getGetSettingsQueryOptions: <TData = Awaited<ReturnType<typeof getSettings>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetSettingsQueryResult = NonNullable<Awaited<ReturnType<typeof getSettings>>>;
export type GetSettingsQueryError = ErrorType<unknown>;
/**
 * @summary Get system settings
 */
export declare function useGetSettings<TData = Awaited<ReturnType<typeof getSettings>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateSettingsUrl: () => string;
/**
 * @summary Update system settings
 */
export declare const updateSettings: (updateSettingsBody: UpdateSettingsBody, options?: Parameters<typeof customFetch>[1]) => Promise<Settings>;
export declare const getUpdateSettingsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError, {
        data: BodyType<UpdateSettingsBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError, {
    data: BodyType<UpdateSettingsBody>;
}, TContext>;
export type UpdateSettingsMutationResult = NonNullable<Awaited<ReturnType<typeof updateSettings>>>;
export type UpdateSettingsMutationBody = BodyType<UpdateSettingsBody>;
export type UpdateSettingsMutationError = ErrorType<unknown>;
/**
* @summary Update system settings
*/
export declare const useUpdateSettings: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError, {
        data: BodyType<UpdateSettingsBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateSettings>>, TError, {
    data: BodyType<UpdateSettingsBody>;
}, TContext>;
export declare const getGetPublicAmProfileUrl: (slug: string, params: GetPublicAmProfileParams) => string;
/**
 * @summary Get public AM profile (requires NIK verification)
 */
export declare const getPublicAmProfile: (slug: string, params: GetPublicAmProfileParams, options?: Parameters<typeof customFetch>[1]) => Promise<PublicAmProfile>;
export declare const getGetPublicAmProfileQueryKey: (slug: string, params?: GetPublicAmProfileParams) => readonly [`/api/public/am/${string}`, ...GetPublicAmProfileParams[]];
export declare const getGetPublicAmProfileQueryOptions: <TData = Awaited<ReturnType<typeof getPublicAmProfile>>, TError = ErrorType<ErrorResponse>>(slug: string, params: GetPublicAmProfileParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPublicAmProfile>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPublicAmProfile>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPublicAmProfileQueryResult = NonNullable<Awaited<ReturnType<typeof getPublicAmProfile>>>;
export type GetPublicAmProfileQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get public AM profile (requires NIK verification)
 */
export declare function useGetPublicAmProfile<TData = Awaited<ReturnType<typeof getPublicAmProfile>>, TError = ErrorType<ErrorResponse>>(slug: string, params: GetPublicAmProfileParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPublicAmProfile>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map