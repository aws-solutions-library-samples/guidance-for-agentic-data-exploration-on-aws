import { useState, useEffect } from 'react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import AppLayout from '@cloudscape-design/components/app-layout';
import { Breadcrumbs, ServiceNavigation } from '../side-navigation';
import { Alert } from '@cloudscape-design/components';

export function UserProfileView() {
  const [userInfo, setUserInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const attributes = await fetchUserAttributes();
        setUserInfo(attributes);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user attributes:', error);
        setLoading(false);
      }
    };

    loadUserInfo();
  }, []);

  const breadcrumbItems = [
    { text: 'User Profile', href: '#/profile' }
  ];

  const content = (
    <SpaceBetween size="l">
      <Breadcrumbs items={breadcrumbItems} />
      
      <Container>
        <SpaceBetween size="l">
          <Header variant="h1">
            Panoptic User Profile
          </Header>

          {loading ? (
            <Alert data-testid="alert" type="info">Loading user information...</Alert>
          ) : (
            <Form>
              <ColumnLayout columns={1} variant="text-grid">
                <SpaceBetween size="l">
                  <FormField label="Name">
                    <Box variant="p">{userInfo.name || 'Not provided'}</Box>
                  </FormField>

                  <FormField label="Email">
                    <Box variant="p">{userInfo.email}</Box>
                  </FormField>

                  <FormField label="User ID">
                    <Box variant="p">{userInfo.sub}</Box>
                  </FormField>
                </SpaceBetween>
              </ColumnLayout>
            </Form>
          )}
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );

  return (
    <AppLayout
      navigation={<ServiceNavigation />}
      content={content}
      toolsHide={true}
    />
  );
}

export default UserProfileView;
