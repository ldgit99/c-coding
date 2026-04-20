#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    int *p = arr;
    for (int i = n - 1; i >= 0; i--) {
        printf("%d", *(p + i));
        if (i > 0) printf(" ");
    }
    printf("\n");
    return 0;
}
