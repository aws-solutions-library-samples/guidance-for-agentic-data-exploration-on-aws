import TopNavigation from "@cloudscape-design/components/top-navigation";
import { useState, useEffect } from 'react';
import { getCurrentUser, fetchUserAttributes, AuthUser } from 'aws-amplify/auth';

const logo = "/images/logo.png";

const i18nStrings = {
  searchIconAriaLabel: "Search",
  searchDismissIconAriaLabel: "Close search",
  overflowMenuTriggerText: "More",
  overflowMenuTitleText: "All",
  overflowMenuBackIconAriaLabel: "Back",
  overflowMenuDismissIconAriaLabel: "Close menu"
};

const profileActions = [
  { id: 'profile', text: 'Profile' },
  // { id: 'preferences', text: 'Preferences' },
  { id: 'signout', text: 'Sign out' }
];

type HeaderNavigationProps =  {
  user: AuthUser | undefined;
  signOut?: ()=>void
}

export function HeaderNavigation(props:HeaderNavigationProps) {

  const [userInfo, setUserInfo] = useState<any>();
  const handleActionClick = async (e: { detail: { id: string } }) => {
    console.log('Action clicked:', e.detail.id);
    if (e.detail.id === 'signout') {
      try {
        props.signOut && props.signOut();
      } catch (error) {
        console.error('Error signing out:', error);
      }
    } else if (e.detail.id === 'profile') {
      // Navigate to profile page
      window.location.href = '#/profile';
    }
  };

  useEffect(() => {
    fetchUserAttributes().then(ua=>setUserInfo(ua))
      .catch(err=>console.error(err));
  }, [ props.user ])

  return (
    <TopNavigation id="top-navigation"
      data-testid='top-navigation'
      i18nStrings={i18nStrings}
      identity={{
        href: '/#/',
        title: 'Panoptic',
        logo: { src: logo, alt: 'Panoptic Logo' }
      }}
      utilities={[
        {
          type: 'menu-dropdown',
          text: '',
          description: userInfo?.email,
          iconName: 'user-profile',
          items: profileActions,
          onItemClick: handleActionClick
        }
      ]}
    />
  );
}
