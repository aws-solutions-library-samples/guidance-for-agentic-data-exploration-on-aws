import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "react-router-dom";
import { RestApiClient } from "../utils/ApiClient";

export function useScreenQuery<T>() {
    const { pathname } = useLocation()
    const screenName = pathname.split('/')[1]
    const client = new RestApiClient<T>(screenName);
    const { id } = useParams();
  
    const { data, isLoading, refetch } = useQuery({
      queryKey: [screenName],
      queryFn: ()=>client.getAll(),
    })
    const { data:dataDetail, isLoading:isLoadingDetail } = useQuery({
      queryKey: [screenName, id],
      queryFn: ()=>client.get(id!),
      enabled: !!id
    })
  
    return { data, dataDetail, isLoading, isLoadingDetail, screenName, selectedItem:id, refetch }
  
}
