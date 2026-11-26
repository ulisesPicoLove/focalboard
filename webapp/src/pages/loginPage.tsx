// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'
import {Link, Redirect, useLocation, useHistory} from 'react-router-dom'
import {FormattedMessage, useIntl} from 'react-intl'

import {useAppDispatch, useAppSelector} from '../store/hooks'
import {fetchMe, getLoggedIn} from '../store/users'
import {getAuthMode, googleAuthMode} from '../store/clientConfig'

import Button from '../widgets/buttons/button'
import GoogleLogo from '../widgets/icons/googleLogo'
import client from '../octoClient'
import {Utils} from '../utils'
import './loginPage.scss'

const LoginPage = () => {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const dispatch = useAppDispatch()
    const loggedIn = useAppSelector<boolean|null>(getLoggedIn)
    const authMode = useAppSelector<string|undefined>(getAuthMode)
    const queryParams = new URLSearchParams(useLocation().search)
    const history = useHistory()
    const intl = useIntl()

    const handleLogin = async (): Promise<void> => {
        const logged = await client.login(username, password)
        if (logged) {
            await dispatch(fetchMe())
            if (queryParams) {
                history.push(queryParams.get('r') || '/')
            } else {
                history.push('/')
            }
        } else {
            setErrorMessage('Login failed')
        }
    }

    const handleGoogleLogin = () => {
        // A full page navigation: the server redirects the browser to Google.
        const returnTo = queryParams.get('r')
        const query = returnTo ? `?r=${encodeURIComponent(returnTo)}` : ''
        window.location.assign(`${Utils.getBaseURL(true).replace(/\/$/, '')}/oauth/google/login${query}`)
    }

    if (loggedIn) {
        return <Redirect to={'/'}/>
    }

    // The sign-in mode arrives with the client config: show nothing instead of
    // flashing the wrong form.
    if (!authMode) {
        return null
    }

    if (authMode === googleAuthMode) {
        const ssoErrors: Record<string, string> = {
            sso_denied: intl.formatMessage({id: 'login.sso-error-denied', defaultMessage: 'Google sign-in was cancelled.'}),
            sso_domain: intl.formatMessage({id: 'login.sso-error-domain', defaultMessage: 'That Google account is not allowed here. Use your company account.'}),
            sso_unverified: intl.formatMessage({id: 'login.sso-error-unverified', defaultMessage: 'The email address of that Google account is not verified.'}),
            sso_expired: intl.formatMessage({id: 'login.sso-error-expired', defaultMessage: 'The sign-in expired. Please try again.'}),
            sso_unavailable: intl.formatMessage({id: 'login.sso-error-unavailable', defaultMessage: 'Google sign-in is not available right now.'}),
            sso_failed: intl.formatMessage({id: 'login.sso-error-failed', defaultMessage: 'Sign-in failed. Please try again.'}),
        }
        const errorCode = queryParams.get('error')
        const ssoError = errorCode ? (ssoErrors[errorCode] || ssoErrors.sso_failed) : ''

        return (
            <div className='LoginPage LoginPage--sso'>
                <div className='title'>
                    <FormattedMessage
                        id='login.log-in-title'
                        defaultMessage='Log in'
                    />
                </div>
                <Button
                    className='google-signin'
                    icon={<GoogleLogo/>}
                    onClick={handleGoogleLogin}
                >
                    <FormattedMessage
                        id='login.sign-in-with-google'
                        defaultMessage='Sign in with Google'
                    />
                </Button>
                {ssoError &&
                    <div
                        className='error'
                        role='alert'
                    >
                        {ssoError}
                    </div>
                }
            </div>
        )
    }

    return (
        <div className='LoginPage'>
            <form
                onSubmit={(e: React.FormEvent) => {
                    e.preventDefault()
                    handleLogin()
                }}
            >
                <div className='title'>
                    <FormattedMessage
                        id='login.log-in-title'
                        defaultMessage='Log in'
                    />
                </div>
                <div className='username'>
                    <input
                        id='login-username'
                        placeholder={'Enter username'}
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value)
                            setErrorMessage('')
                        }}
                    />
                </div>
                <div className='password'>
                    <input
                        id='login-password'
                        type='password'
                        placeholder={'Enter password'}
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value)
                            setErrorMessage('')
                        }}
                    />
                </div>
                <Button
                    filled={true}
                    submit={true}
                >
                    <FormattedMessage
                        id='login.log-in-button'
                        defaultMessage='Log in'
                    />
                </Button>
            </form>
            <Link to='/register'>
                <FormattedMessage
                    id='login.register-button'
                    defaultMessage={'or create an account if you don\'t have one'}
                />
            </Link>
            {errorMessage &&
                <div className='error'>
                    {errorMessage}
                </div>
            }
        </div>
    )
}

export default React.memo(LoginPage)
