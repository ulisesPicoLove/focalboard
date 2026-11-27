// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react'
import {useIntl} from 'react-intl'
import {useHistory} from 'react-router-dom'

import {Constants} from '../../constants'
import octoClient from '../../octoClient'
import {IUser} from '../../user'
import PicoboardLogo from '../../widgets/icons/picoboardLogo'
import Menu from '../../widgets/menu'
import MenuWrapper from '../../widgets/menuWrapper'
import {getMe, setMe} from '../../store/users'
import {getAuthMode, googleAuthMode} from '../../store/clientConfig'
import {useAppSelector, useAppDispatch} from '../../store/hooks'

import ModalWrapper from '../modalWrapper'

import RegistrationLink from './registrationLink'

import './sidebarUserMenu.scss'

const SidebarUserMenu = () => {
    const dispatch = useAppDispatch()
    const history = useHistory()
    const [showRegistrationLinkDialog, setShowRegistrationLinkDialog] = useState(false)
    const user = useAppSelector<IUser|null>(getMe)
    const authMode = useAppSelector<string|undefined>(getAuthMode)
    const passwordLogin = authMode !== googleAuthMode
    const intl = useIntl()

    return (
        <div className='SidebarUserMenu'>
            <ModalWrapper>
                <MenuWrapper>
                    <div className='logo'>
                        <div className='logo-title'>
                            <PicoboardLogo/>
                            <span>{'Picoboard'}</span>
                            <div className='versionFrame'>
                                <div
                                    className='version'
                                    title={`v${Constants.versionString}`}
                                >
                                    {`v${Constants.versionString}`}
                                </div>
                            </div>
                        </div>
                    </div>
                    <Menu>
                        {user && user.username !== 'single-user' && <>
                            <Menu.Label><b>{user.username}</b></Menu.Label>
                            <Menu.Text
                                id='logout'
                                name={intl.formatMessage({id: 'Sidebar.logout', defaultMessage: 'Log out'})}
                                onClick={async () => {
                                    await octoClient.logout()
                                    dispatch(setMe(null))
                                    history.push('/login')
                                }}
                            />
                            {passwordLogin &&
                                <Menu.Text
                                    id='changePassword'
                                    name={intl.formatMessage({id: 'Sidebar.changePassword', defaultMessage: 'Change password'})}
                                    onClick={async () => {
                                        history.push('/change_password')
                                    }}
                                />
                            }
                            {passwordLogin &&
                                <Menu.Text
                                    id='invite'
                                    name={intl.formatMessage({id: 'Sidebar.invite-users', defaultMessage: 'Invite users'})}
                                    onClick={async () => {
                                        setShowRegistrationLinkDialog(true)
                                    }}
                                />
                            }
                        </>}
                    </Menu>
                </MenuWrapper>

                {showRegistrationLinkDialog &&
                    <RegistrationLink
                        onClose={() => {
                            setShowRegistrationLinkDialog(false)
                        }}
                    />
                }
            </ModalWrapper>
        </div>
    )
}

export default React.memo(SidebarUserMenu)
