import { useEffect, useState } from "react";
import { onSnapshot, query } from "firebase/firestore";
import { firebaseErrorMessage } from "../firebase/errors";

export function useCollection(collectionRef, ...constraints) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!collectionRef) {
      setData([]);
      setLoading(false);
      return undefined;
    }
    const reference = constraints.length ? query(collectionRef, ...constraints) : collectionRef;
    const unsubscribe = onSnapshot(
      reference,
      (snapshot) => {
        setData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        setError(firebaseErrorMessage(snapshotError));
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [collectionRef]);

  return { data, loading, error };
}
