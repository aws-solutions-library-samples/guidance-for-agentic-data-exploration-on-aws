import { useState, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

function useSSMParameter(name:string, region:string): { value: string | string [] | null | undefined, loading: boolean, error: any } {
  const [value, setValue] = useState<string | string[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<any|null>(null);

  useEffect(() => {
    const fetchParameters = async () => {
      setLoading(true);
      setError(null);
      try {
        const { credentials } = await fetchAuthSession();
        const ssm = new SSMClient({ credentials, region: region });
        const {Parameter} = await ssm.send(new GetParameterCommand({
          Name: name
        }));
        setValue(Parameter!.Type == 'StringList' ? 
          Parameter!.Value!.split(',')
          : Parameter!.Value!)
      } catch (err) {
        console.error("ssm error",error)
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchParameters()
  }, [name]);

  return { value, loading, error };
};

export default useSSMParameter;